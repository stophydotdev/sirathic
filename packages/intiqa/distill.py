"""Train a small multilingual cross-encoder student on the teacher's scores (serving option C).

  python distill.py <student> <out dir> [--epochs 2] [--lr 3e-5] [--doc-tokens 512] [--groups 16]

Data: distill/pools.jsonl (one row per question: "pid", "query", "docs": [{"text"}]) and
distill/teacher.jsonl (score.py output: "id" = pid, "scores" aligned with docs). Each step takes
--groups questions with all their candidates; the loss per question is the listwise KL between
softmax(teacher) and softmax(student) plus --mse x MSE on the raw scores, so the student learns
both the order and the teacher's scale (logit yes - no). 2% of questions (by pid hash) are held
out: validation reports KL, the student's nDCG@10 against the teacher's order and Spearman, four
times per epoch, and the best of those checkpoints is kept (out/best); a run is data-limited
when validation still improves at the end.
Students (decision D): cross-encoder/mmarco-mMiniLMv2-L12-H384-v1 (Apache-2.0; already a
multilingual reranker) and a 6-layer student cut from it (--layers 6).
Passages are cut to --doc-tokens Qwen3 tokens (as in evaluation), then to the student's 512 limit.
"""

import argparse
import hashlib
import json
import math
import random
import time
from pathlib import Path

import torch
import torch.nn.functional as F

from prompts import tokenizer as qwen_tokenizer


def read(path) -> list[dict]:
    return [json.loads(l) for l in Path(path).read_text().split("\n") if l.strip()]


def cut_batch(texts: list[str], max_tokens: int) -> list[str]:
    fast = qwen_tokenizer()
    out = []
    for t, enc in zip(texts, fast.encode_batch(texts, add_special_tokens=False)):
        out.append(t if len(enc.ids) <= max_tokens else t[:enc.offsets[max_tokens - 1][1]] + "…")
    return out


def ndcg_vs_teacher(s: list[float], t: list[float]) -> float:
    """nDCG@10 of the student's order with the teacher's softmax probabilities as gains."""
    p = torch.softmax(torch.tensor(t), 0).tolist()
    order = sorted(range(len(s)), key=lambda i: -s[i])
    ideal = sorted(p, reverse=True)
    dcg = sum(p[i] / math.log2(k + 2) for k, i in enumerate(order[:10]))
    return dcg / sum(x / math.log2(k + 2) for k, x in enumerate(ideal[:10]))


def spearman(a: list[float], b: list[float]) -> float:
    ra = {i: r for r, i in enumerate(sorted(range(len(a)), key=lambda i: a[i]))}
    rb = {i: r for r, i in enumerate(sorted(range(len(b)), key=lambda i: b[i]))}
    n = len(a)
    return 1 - 6 * sum((ra[i] - rb[i]) ** 2 for i in range(n)) / (n * (n * n - 1)) if n > 1 else 1.0


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("student")
    ap.add_argument("out")
    ap.add_argument("--pools", default="distill/pools.jsonl")
    ap.add_argument("--teacher", default="distill/teacher.jsonl")
    ap.add_argument("--epochs", type=float, default=2.0)
    ap.add_argument("--lr", type=float, default=3e-5)
    ap.add_argument("--groups", type=int, default=16)
    ap.add_argument("--doc-tokens", type=int, default=512)
    ap.add_argument("--max-length", type=int, default=512)
    ap.add_argument("--mse", type=float, default=0.1)
    ap.add_argument("--micro", type=int, default=128, help="pairs per forward pass")
    ap.add_argument("--warmup", type=float, default=0.05)
    ap.add_argument("--seed", type=int, default=13)
    ap.add_argument("--limit", type=int, default=0, help="use only the first N questions (timing)")
    ap.add_argument("--time-sample", type=int, default=0)
    ap.add_argument("--layers", type=int, default=0, help="keep only the first N encoder layers (XLM-R students)")
    ap.add_argument("--start-step", type=int, default=0,
                    help="resume: the student path is a saved checkpoint; continue the same schedule and data order from this step")
    ap.add_argument("--best-so-far", type=float, default=-1.0, help="resume: validation score of the saved best checkpoint")
    args = ap.parse_args()

    from transformers import AutoModelForSequenceClassification, AutoTokenizer

    random.seed(args.seed)
    torch.manual_seed(args.seed)
    torch.backends.cuda.matmul.allow_tf32 = True
    teacher = {r["id"]: r["scores"] for r in read(args.teacher)}
    groups = []
    for r in read(args.pools):
        t = teacher.get(r["pid"])
        if t and len(t) == len(r["docs"]) and len(t) >= 2:
            groups.append({"pid": r["pid"], "query": r["query"], "texts": [d["text"] for d in r["docs"]], "t": t})
    if args.limit:
        groups = groups[:args.limit]
    for g in groups:
        g["texts"] = cut_batch(g["texts"], args.doc_tokens)
    is_val = lambda g: int(hashlib.md5(g["pid"].encode()).hexdigest(), 16) % 100 < 2
    val = [g for g in groups if is_val(g)][:600]
    train = [g for g in groups if not is_val(g)]
    tok = AutoTokenizer.from_pretrained(args.student)
    model = AutoModelForSequenceClassification.from_pretrained(args.student, num_labels=1).cuda()
    if args.layers:  # a shallower student cut from the same cross-encoder; the saved config records the depth
        model.roberta.encoder.layer = model.roberta.encoder.layer[:args.layers]
        model.config.num_hidden_layers = args.layers
    model.train()

    def scores(g_list, grad: bool) -> list[torch.Tensor]:
        pairs = [(g["query"], t) for g in g_list for t in g["texts"]]
        out = []
        for start in range(0, len(pairs), args.micro):
            part = pairs[start:start + args.micro]
            qs, ts = [q for q, _ in part], [t for _, t in part]
            try:
                enc = tok(qs, ts, truncation="only_second", max_length=args.max_length, padding=True, return_tensors="pt")
            except Exception:  # a question longer than the limit on its own (token-dense scripts): cut the longer side
                enc = tok(qs, ts, truncation="longest_first", max_length=args.max_length, padding=True, return_tensors="pt")
            enc = enc.to("cuda")
            with torch.autocast("cuda", dtype=torch.bfloat16), torch.set_grad_enabled(grad):
                out.append(model(**enc).logits[:, 0].float())
        flat = torch.cat(out)
        res, at = [], 0
        for g in g_list:
            res.append(flat[at:at + len(g["texts"])])
            at += len(g["texts"])
        return res

    @torch.no_grad()
    def validate() -> dict:
        model.eval()
        kl, nd, sp = [], [], []
        for start in range(0, len(val), args.groups):
            part = val[start:start + args.groups]
            for g, s in zip(part, scores(part, False)):
                t = torch.tensor(g["t"], device="cuda")
                kl.append(F.kl_div(F.log_softmax(s, 0), F.log_softmax(t, 0), log_target=True, reduction="sum").item())
                nd.append(ndcg_vs_teacher(s.tolist(), g["t"]))
                sp.append(spearman(s.tolist(), g["t"]))
        model.train()
        return {"val_kl": round(sum(kl) / len(kl), 4), "val_ndcg_vs_teacher": round(sum(nd) / len(nd), 4),
                "val_spearman": round(sum(sp) / len(sp), 4)}

    steps_per_epoch = math.ceil(len(train) / args.groups)
    total = args.time_sample or int(steps_per_epoch * args.epochs)
    opt = torch.optim.AdamW(model.parameters(), lr=args.lr, weight_decay=0.01)  # a resumed run starts fresh moments
    warm = max(1, int(total * args.warmup))
    lr_at = lambda s: (s + 1) / warm if s < warm else max(0.0, (total - s) / max(1, total - warm))
    sched = torch.optim.lr_scheduler.LambdaLR(opt, lambda s: lr_at(s + args.start_step))
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    log = (out / "log.jsonl").open("a")
    print(f"train questions {len(train)}, val {len(val)}, steps {total}", flush=True)
    every = max(1, steps_per_epoch // 4)
    step, t0, seen, best = args.start_step, time.time(), 0, args.best_so_far
    epoch = step // steps_per_epoch
    skip = step - epoch * steps_per_epoch  # batches of the current epoch already trained before a resume
    while step < total:
        order = list(range(len(train)))
        random.Random(args.seed + epoch).shuffle(order)
        for start in range(skip * args.groups, len(order), args.groups):
            if step >= total:
                break
            part = [train[i] for i in order[start:start + args.groups]]
            loss = 0.0
            for g, s in zip(part, scores(part, True)):
                t = torch.tensor(g["t"], device="cuda")
                loss = loss + (F.kl_div(F.log_softmax(s, 0), F.log_softmax(t, 0), log_target=True, reduction="sum")
                               + args.mse * F.mse_loss(s, t)) / len(part)
                seen += len(g["texts"])
            opt.zero_grad(set_to_none=True)
            loss.backward()
            torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
            opt.step()
            sched.step()
            step += 1
            el = time.time() - t0
            if step % 20 == 0 or args.time_sample:
                done = step - args.start_step
                rec = {"step": step, "loss": round(loss.item(), 4), "pairs_per_s": round(seen / el, 1),
                       "eta_h": round(el / done * (total - step) / 3600, 2)}
                log.write(json.dumps(rec) + "\n")
                log.flush()
                print(rec, flush=True)
            if not args.time_sample and step % every == 0:
                rec = {"step": step, "epoch": round(step / steps_per_epoch, 2), **validate()}
                log.write(json.dumps(rec) + "\n")
                log.flush()
                print(rec, flush=True)
                if rec["val_ndcg_vs_teacher"] > best:  # validation (agreement with the teacher) picks the checkpoint
                    best = rec["val_ndcg_vs_teacher"]
                    model.save_pretrained(out / "best")
                    tok.save_pretrained(out / "best")
        epoch += 1
        skip = 0
    if not args.time_sample:
        model.save_pretrained(out / "final")
        tok.save_pretrained(out / "final")
        print("done", flush=True)


if __name__ == "__main__":
    main()
