# Intiqa

Puts the passages that answer a question about Islam first. It reranks 20 search results in about 0.37 s on an 8-core CPU.

It runs in Sirathic between search and the answer model. The weights are on Hugging Face: [sirathic/intiqa](https://huggingface.co/sirathic/intiqa).

```bash
pip install sentence-transformers
```

```python
from sentence_transformers import CrossEncoder

intiqa = CrossEncoder("sirathic/intiqa", max_length=256)
passages = [
    "Combining Maghrib and Isha because of rain is allowed by the Shafi'i, Maliki and Hanbali schools...",
    "The times of the five daily prayers are...",
]
for hit in intiqa.rank("Can I combine Maghrib and Isha when it's raining?", passages):
    print(hit["corpus_id"], hit["score"])
```

`rank` returns the passages best first. A score is a raw logit: higher means more relevant. Compare scores only within one question.

## Benchmarks

293 questions about Islam (English 90, Arabic 88, Urdu 52, Indonesian 48, Turkish 9, French 9), each with about 20 passages from Quran, hadith, fatwa and fiqh search, graded by Claude Opus. nDCG@10, and how often a passage that directly answers the question comes first.

| Model | 256 tokens | Top-1 | 512 tokens | Top-1 |
|---|---|---|---|---|
| Search alone, no reranker | 0.625 | 44.5% | 0.625 | 44.5% |
| mMiniLM-L12 base (before training) | 0.691 | 53.5% | 0.698 | 56.7% |
| gte-multilingual-reranker-base | 0.702 | 55.1% | 0.719 | 55.1% |
| Qwen3-Reranker-0.6B | 0.740 | 56.3% | 0.774 | 64.1% |
| **Intiqa** | **0.746** | **58.0%** | **0.786** | **61.2%** |
| Our fine-tuned Qwen3-Reranker-0.6B (Intiqa's teacher) | 0.774 | 56.7% | 0.817 | 64.9% |

Time to rerank 20 passages, p95, bfloat16, one batch, on AWS c7i (Intel Sapphire Rapids):

| Model | 256 tokens, 4 cores | 256 tokens, 8 cores | 128 tokens, 8 cores |
|---|---|---|---|
| **Intiqa** | 0.69 s | **0.37 s** | 0.17 s |
| gte-multilingual-reranker-base | 2.1 s | 1.3 s | 0.71 s |
| Qwen3-Reranker-0.6B | 10 s | 5.5 s | 4.1 s |

These times need a CPU with bfloat16 support, such as AMD Zen 4 or Intel Sapphire Rapids. On other CPUs, fp32 takes about twice as long. ONNX int8 was never faster and scored about 0.02 lower.

## Training

`distill.py` trains Intiqa to match the scores of its teacher, our fine-tuned Qwen3-Reranker-0.6B, on question and passage pairs. `prompts.py` holds the teacher's input format and the grading rubric. Usage is at the top of each file. The training data is not in this repository.
