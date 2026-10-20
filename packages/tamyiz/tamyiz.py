"""Tamyiz: reads one message to an Islamic app and answers 17 questions about it.

    from tamyiz import Tamyiz
    decide = Tamyiz.from_pretrained("sirathic/tamyiz")
    decide("Is it allowed to pray with my shoes on?")

Returns {"answers": {question: {"answer", "probabilities"}}, "route": "self_harm" | "distress" | None}.
"""
import json
from pathlib import Path

import torch
from huggingface_hub import snapshot_download
from safetensors.torch import load_file
from transformers import AutoModel, AutoTokenizer


class Tamyiz:
    def __init__(self, path):
        path = Path(path)
        self.config = json.loads((path / "config.json").read_text(encoding="utf-8"))
        self.tokenizer = AutoTokenizer.from_pretrained(path / "tokenizer")
        self.encoder = AutoModel.from_pretrained(path / "encoder").eval()
        self.heads = load_file(path / "heads.safetensors")

    @classmethod
    def from_pretrained(cls, repo="sirathic/tamyiz"):
        return cls(snapshot_download(repo))

    @torch.inference_mode()
    def __call__(self, message):
        encoded = self.tokenizer(message, truncation=True, max_length=self.config["max_length"], return_tensors="pt")
        hidden = self.encoder(**encoded).last_hidden_state
        mask = encoded["attention_mask"].unsqueeze(-1)
        pooled = ((hidden * mask).sum(1) / mask.sum(1))[0].float()
        answers = {}
        for qid, spec in self.config["questions"].items():
            logits = pooled @ self.heads[f"{qid}.weight"].T + self.heads[f"{qid}.bias"]
            probs = (logits / spec["temperature"]).softmax(-1)
            probs = probs * (torch.tensor(spec["natural_rates"]) * len(probs)) ** spec["shift"]
            probs = probs / probs.sum()
            options = spec["options"]
            answers[qid] = {
                "answer": options[int(probs.argmax())],
                "probabilities": {str(option): round(float(p), 4) for option, p in zip(options, probs)},
            }
        return {"answers": answers, "route": self.route(answers["risk"]["probabilities"])}

    def route(self, risk):
        if risk["self_harm"] >= self.config["routes"]["self_harm"]["min_probability"]:
            return "self_harm"
        others = {option: p for option, p in risk.items() if option != "self_harm"}
        return "distress" if max(others, key=others.get) == "distress" else None
