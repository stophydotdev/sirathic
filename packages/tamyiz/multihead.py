"""Single-pass multi-head decision model: one encoder pass over the message, one head per question.

Usage:
  python multihead.py train <train.jsonl> <model dir> [encoder] [epochs]
  python multihead.py eval <model dir> <eval.jsonl> <report.json> [cuda|cpu]
  python multihead.py predict <model dir> <rows.jsonl> <out.jsonl>
  python multihead.py split <train.jsonl> <val.jsonl>
  python multihead.py latency <model dir> <eval.jsonl> <out.json>
train reads laya-style rows ({state, questions, expected}); a missing answer is simply not trained
on. Every head is balanced on its own with class-weighted cross-entropy (n / (K * n_class) from the
training labels), so no row sampling shifts the other questions. SQRT_HEADS=risk,harm,waswasa uses
the square root of those weights for the heads listed. 10% of the rows, seeded, are held
out: the epoch with the best mean balanced accuracy on them is kept, and one temperature per head is
fitted on them. eval writes a peval-style report (cases in eval-file order) and, beside it,
<report>-prior.json with every head's probabilities moved from the balanced training prior to the
natural class rates of the training labels. INT8=1 with cpu quantizes every linear layer to int8
first (dynamic quantization), as served on CPU; INT8=encoder quantizes the encoder only. predict writes {id, probs: {question: [p per option]}}
per row (rows carry `state` or `text`), at the fitted temperatures, without the prior shift. split
writes the validation slice train holds out. latency times one message at a time on the CPU with 4
threads over 60 eval messages, after 3 warm-ups. MAX_LEN=<tokens> caps the input (default 256) and
BF16=1 runs CPU inference under bfloat16 autocast; both apply to eval and latency.
"""
import json
import math
import os
import random
import sys
import time
from collections import Counter

import torch
from transformers import AutoModel, AutoTokenizer, get_linear_schedule_with_warmup

MAX_LEN = int(os.environ.get("MAX_LEN", 256))


def options_of(question):
    return [False, True] if question["type"] == "noul" else list(question["criteria"])


class MultiHead(torch.nn.Module):
    def __init__(self, encoder, sizes):
        super().__init__()
        self.encoder = AutoModel.from_pretrained(encoder) if isinstance(encoder, str) else encoder
        hidden = self.encoder.config.hidden_size
        self.dropout = torch.nn.Dropout(0.1)
        self.heads = torch.nn.ModuleDict({qid: torch.nn.Linear(hidden, k) for qid, k in sizes.items()})

    def forward(self, ids, mask):
        hidden = self.encoder(input_ids=ids, attention_mask=mask).last_hidden_state
        pooled = (hidden * mask.unsqueeze(-1)).sum(1) / mask.sum(1, keepdim=True)
        pooled = self.dropout(pooled.float())
        return {qid: head(pooled) for qid, head in self.heads.items()}


def read(path):
    return [json.loads(line) for line in open(path, encoding="utf-8") if line.strip()]


def targets(rows, questions):
    """Per question, the option index of each row's answer, or -100 when the row has none."""
    out = {}
    for qid, question in questions.items():
        options = options_of(question)
        out[qid] = torch.tensor([options.index(row["expected"][qid]) if qid in row["expected"] else -100 for row in rows])
    return out


def batches(tokenizer, rows, size):
    for start in range(0, len(rows), size):
        chunk = rows[start:start + size]
        encoded = tokenizer([row["state"] for row in chunk], truncation=True, max_length=MAX_LEN, padding=True, return_tensors="pt")
        yield start, encoded["input_ids"], encoded["attention_mask"]


@torch.no_grad()
def logits_of(model, tokenizer, rows, device, size=64):
    model.eval()
    out = {qid: [] for qid in model.heads}
    for _, ids, mask in batches(tokenizer, rows, size):
        with autocast(device):
            logits = model(ids.to(device), mask.to(device))
        for qid, value in logits.items():
            out[qid].append(value.float().cpu())
    return {qid: torch.cat(values) for qid, values in out.items()}


def autocast(device):
    if device.type != "cuda":
        return torch.autocast("cpu", dtype=torch.bfloat16, enabled=bool(os.environ.get("BF16")))
    dtype = torch.bfloat16 if torch.cuda.get_device_capability(device)[0] >= 8 else torch.float16
    return torch.autocast("cuda", dtype=dtype)


def balanced_accuracy(logits, target):
    keep = target != -100
    predicted, target = logits[keep].argmax(-1), target[keep]
    recalls = [(predicted[target == c] == c).float().mean().item() for c in target.unique()]
    return sum(recalls) / len(recalls)


def split(rows):
    rows = list(rows)
    random.Random(20261020).shuffle(rows)
    n_val = len(rows) // 10
    return rows[:n_val], rows[n_val:]


def train(data, out_dir, encoder="jhu-clsp/mmBERT-base", epochs=4):
    rows = read(data)
    questions = rows[0]["questions"]
    val, train_rows = split(rows)
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    tokenizer = AutoTokenizer.from_pretrained(encoder)
    model = MultiHead(encoder, {qid: len(options_of(q)) for qid, q in questions.items()}).to(device)
    train_targets, val_targets = targets(train_rows, questions), targets(val, questions)
    counts = {qid: Counter(t for t in train_targets[qid].tolist() if t != -100) for qid in questions}
    weights = {}
    sqrt_heads = set(filter(None, os.environ.get("SQRT_HEADS", "").split(",")))
    for qid, question in questions.items():
        k, total = len(options_of(question)), sum(counts[qid].values())
        balanced = [total / (k * counts[qid][c]) if counts[qid][c] else 0.0 for c in range(k)]
        weights[qid] = torch.tensor([math.sqrt(w) if qid in sqrt_heads else w for w in balanced], device=device)
    params = [{"params": model.encoder.parameters(), "lr": 3e-5}, {"params": model.heads.parameters(), "lr": 5e-4}]
    optimizer = torch.optim.AdamW(params, weight_decay=0.01)
    steps = epochs * math.ceil(len(train_rows) / 32)
    scheduler = get_linear_schedule_with_warmup(optimizer, int(0.06 * steps), steps)
    scaler = torch.amp.GradScaler("cuda", enabled=device.type == "cuda" and torch.cuda.get_device_capability(device)[0] < 8)
    best, best_score, history = None, -1.0, []
    for epoch in range(epochs):
        model.train()
        order = list(range(len(train_rows)))
        random.Random(epoch).shuffle(order)
        shuffled = [train_rows[i] for i in order]
        shuffled_targets = {qid: t[order] for qid, t in train_targets.items()}
        start_time, total = time.time(), 0.0
        for start, ids, mask in batches(tokenizer, shuffled, 32):
            with autocast(device):
                logits = model(ids.to(device), mask.to(device))
            loss = 0.0
            for qid, value in logits.items():
                target = shuffled_targets[qid][start:start + len(ids)].to(device)
                if (target != -100).any():
                    loss = loss + torch.nn.functional.cross_entropy(value.float(), target, weight=weights[qid], ignore_index=-100)
            optimizer.zero_grad(set_to_none=True)
            scaler.scale(loss).backward()
            scaler.unscale_(optimizer)
            torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
            scaler.step(optimizer)
            scaler.update()
            scheduler.step()
            total += loss.item()
        val_logits = logits_of(model, tokenizer, val, device)
        score = sum(balanced_accuracy(val_logits[q], val_targets[q]) for q in questions) / len(questions)
        history.append({"epoch": epoch + 1, "loss": total / math.ceil(len(train_rows) / 32), "val_mean_balanced_accuracy": score,
                        "seconds": round(time.time() - start_time, 1)})
        print(history[-1], flush=True)
        if score > best_score:
            best_score, best = score, {k: v.detach().cpu().clone() for k, v in model.state_dict().items()}
    model.load_state_dict(best)
    val_logits = logits_of(model, tokenizer, val, device)
    temperatures = {}
    for qid in questions:
        keep = val_targets[qid] != -100
        logits, target = val_logits[qid][keep], val_targets[qid][keep]
        log_t = torch.zeros(1, requires_grad=True)
        opt = torch.optim.LBFGS([log_t], lr=0.1, max_iter=100)

        def closure():
            opt.zero_grad()
            loss = torch.nn.functional.cross_entropy(logits / log_t.exp(), target)
            loss.backward()
            return loss

        opt.step(closure)
        temperatures[qid] = float(log_t.exp().clamp(0.1, 10.0))
    os.makedirs(out_dir, exist_ok=True)
    model.encoder.save_pretrained(os.path.join(out_dir, "encoder"))
    tokenizer.save_pretrained(os.path.join(out_dir, "tokenizer"))
    torch.save(model.heads.state_dict(), os.path.join(out_dir, "heads.pt"))
    natural = {qid: [counts[qid][c] / sum(counts[qid].values()) for c in range(len(options_of(q)))] for qid, q in questions.items()}
    config = {"encoder": encoder, "questions": questions, "temperatures": temperatures, "natural_rates": natural,
              "history": history, "train_rows": len(train_rows), "val_rows": len(val)}
    json.dump(config, open(os.path.join(out_dir, "config.json"), "w"), indent=2, ensure_ascii=False)
    print(json.dumps({"temperatures": temperatures, "best_val_mean_balanced_accuracy": best_score}), flush=True)


def load(model_dir, device):
    config = json.load(open(os.path.join(model_dir, "config.json"), encoding="utf-8"))
    encoder = AutoModel.from_pretrained(os.path.join(model_dir, "encoder"))
    model = MultiHead(encoder, {qid: len(options_of(q)) for qid, q in config["questions"].items()})
    model.heads.load_state_dict(torch.load(os.path.join(model_dir, "heads.pt"), map_location="cpu"))
    tokenizer = AutoTokenizer.from_pretrained(os.path.join(model_dir, "tokenizer"))
    return model.to(device).eval(), tokenizer, config


def evaluate(model_dir, data, out, device_name="cuda"):
    device = torch.device(device_name if device_name == "cpu" or torch.cuda.is_available() else "cpu")
    model, tokenizer, config = load(model_dir, device)
    if os.environ.get("INT8") and device.type == "cpu":
        if os.environ["INT8"] == "encoder":
            model.encoder = torch.ao.quantization.quantize_dynamic(model.encoder, {torch.nn.Linear}, dtype=torch.qint8)
        else:
            model = torch.ao.quantization.quantize_dynamic(model, {torch.nn.Linear}, dtype=torch.qint8)
    rows = read(data)
    start = time.perf_counter()
    logits = logits_of(model, tokenizer, rows, device)
    seconds = time.perf_counter() - start
    for prior in (False, True):
        cases = []
        for r, row in enumerate(rows):
            for qid in row["questions"]:
                if qid not in row["expected"] or qid not in config["questions"]:
                    continue
                options = options_of(config["questions"][qid])
                probs = (logits[qid][r] / config["temperatures"][qid]).softmax(-1)
                if prior:
                    probs = probs * torch.tensor(config["natural_rates"][qid]) * len(options)
                    probs = probs / probs.sum()
                index = int(probs.argmax())
                if options == [False, True]:
                    answer = {"type": "noul", "noul": float(probs[1])}
                else:
                    answer = {"type": "choice", "choice": options[index],
                              "probabilities": {o: round(float(p), 4) for o, p in zip(options, probs)}}
                cases.append({"qid": qid, "language": row.get("language"), "expected": row["expected"][qid], "answer": answer,
                              "confidence": float(probs.max()), "correct": options[index] == row["expected"][qid]})
        path = out.replace(".json", "-prior.json") if prior else out
        json.dump({"config": {"model": model_dir, "seconds": round(seconds, 2), "rows": len(rows), "prior_shift": prior}, "cases": cases},
                  open(path, "w", encoding="utf-8"))
    print(f"{model_dir}: {len(rows)} rows in {seconds:.1f}s on {device}", flush=True)


def predict(model_dir, data, out):
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    model, tokenizer, config = load(model_dir, device)
    rows = [dict(row, state=row.get("state") or row["text"]) for row in read(data)]
    start = time.perf_counter()
    logits = logits_of(model, tokenizer, rows, device, size=128)
    with open(out, "w", encoding="utf-8") as handle:
        for r, row in enumerate(rows):
            probs = {qid: [round(float(p), 4) for p in (logits[qid][r] / config["temperatures"][qid]).softmax(-1)] for qid in logits}
            handle.write(json.dumps({"id": row.get("id", r), "probs": probs}) + "\n")
    print(f"{model_dir}: predicted {len(rows)} rows in {time.perf_counter() - start:.1f}s on {device}", flush=True)


def latency(model_dir, data, out):
    torch.set_num_threads(4)
    model, tokenizer, config = load(model_dir, torch.device("cpu"))
    rows = read(data)
    messages = [row["state"] for row in rows[::max(1, len(rows) // 60)]][:60]

    def run(message):
        encoded = tokenizer(message, truncation=True, max_length=MAX_LEN, return_tensors="pt")
        with torch.inference_mode(), autocast(torch.device("cpu")):
            model(encoded["input_ids"], encoded["attention_mask"])

    for message in messages[:3]:
        run(message)
    times = []
    for message in messages:
        start = time.perf_counter()
        run(message)
        times.append((time.perf_counter() - start) * 1000)
    times.sort()
    result = {"max_len": MAX_LEN, "bf16": bool(os.environ.get("BF16")), "p50_ms": round(times[len(times) // 2], 1),
              "p95_ms": round(times[int(0.95 * len(times)) - 1], 1), "cpu": open("/proc/cpuinfo").read().split("model name")[1].split("\n")[0].strip(": \t")}
    json.dump(result, open(out, "w"))
    print(json.dumps(result), flush=True)


if __name__ == "__main__":
    command, *args = sys.argv[1:]
    if command == "latency":
        latency(*args)
    elif command == "predict":
        predict(*args)
    elif command == "split":
        val, _ = split(read(args[0]))
        open(args[1], "w", encoding="utf-8").write("".join(json.dumps(row, ensure_ascii=False) + "\n" for row in val))
    elif command == "train":
        train(args[0], args[1], *(args[2:3] or []), *([int(args[3])] if len(args) > 3 else []))
    else:
        evaluate(*args)
