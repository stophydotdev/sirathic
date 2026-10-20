"""Exports Tamyiz to one ONNX file the server runs: token ids in, one logits output per question.

    python export.py <out dir>

The out dir gets model.onnx, tokenizer.json, tokenizer_config.json and config.json. Temperatures,
the prior shift and the routes stay in config.json and are applied by the caller, as in tamyiz.py.
"""
import shutil
import sys
from pathlib import Path

import torch
from huggingface_hub import snapshot_download

from tamyiz import Tamyiz


class Logits(torch.nn.Module):
    def __init__(self, tamyiz):
        super().__init__()
        self.encoder = tamyiz.encoder
        self.questions = list(tamyiz.config["questions"])
        for qid in self.questions:
            self.register_buffer(f"{qid}_weight", tamyiz.heads[f"{qid}.weight"].float())
            self.register_buffer(f"{qid}_bias", tamyiz.heads[f"{qid}.bias"].float())

    def forward(self, input_ids, attention_mask):
        hidden = self.encoder(input_ids=input_ids, attention_mask=attention_mask).last_hidden_state
        mask = attention_mask.unsqueeze(-1).to(hidden.dtype)
        pooled = (hidden * mask).sum(1) / mask.sum(1)
        return tuple(
            pooled @ getattr(self, f"{qid}_weight").T + getattr(self, f"{qid}_bias") for qid in self.questions
        )


def export(out):
    path = Path(snapshot_download("sirathic/tamyiz"))
    tamyiz = Tamyiz(path)
    graph = Logits(tamyiz).eval()
    sample = tamyiz.tokenizer("Is it allowed to pray with my shoes on?", return_tensors="pt")
    out.mkdir(parents=True, exist_ok=True)
    seq = torch.export.Dim("seq", min=2, max=tamyiz.config["max_length"])
    torch.onnx.export(
        graph,
        (sample["input_ids"], sample["attention_mask"]),
        out / "model.onnx",
        input_names=["input_ids", "attention_mask"],
        output_names=graph.questions,
        dynamic_shapes={"input_ids": {1: seq}, "attention_mask": {1: seq}},
        external_data=False,
    )
    for name in ("tokenizer.json", "tokenizer_config.json"):
        shutil.copy(path / "tokenizer" / name, out / name)
    shutil.copy(path / "config.json", out / "config.json")


if __name__ == "__main__":
    export(Path(sys.argv[1]))
