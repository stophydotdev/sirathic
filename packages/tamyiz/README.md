# Tamyiz

Reads one message sent to Sirathic and answers 17 questions about it in about 50 ms on a CPU: is it about Islam, what does the person want, does it need the web or a scholar, and is the person at risk of harming themselves.

The weights, scores and limits are on Hugging Face: [sirathic/tamyiz](https://huggingface.co/sirathic/tamyiz). Only the self-harm route is ready to act on. Log the other answers.

```bash
pip install torch transformers safetensors huggingface_hub
cd packages/tamyiz
python -c 'from tamyiz import Tamyiz; print(Tamyiz.from_pretrained()("Is it allowed to pray with my shoes on?")["route"])'
```

`Tamyiz.from_pretrained()` downloads the model once. A call returns `{"answers": {question: {"answer", "probabilities"}}, "route": "self_harm" | "distress" | None}`. `config.json` holds every question, its options and the route threshold.

`multihead.py` is the training script. Its usage is at the top of the file. The training data is not in this repository.

## Benchmarks

916 hand-labelled messages in Arabic, English, French, Indonesian, Turkish and Urdu. Laya is our previous model, which asked each question separately.

| | Laya | Tamyiz |
|---|---|---|
| Accuracy over all answers | 90.4% | 90.0% |
| Calibration error (ECE, lower is better) | 6.0 | 1.8 |
| Share of wrong answers made at 90%+ confidence | 62% | 23% |
| Median time per message, 4 CPU threads | 3,363 ms | 50 ms |

Rare answers found (recall of the less common options):

| Question | Laya | Tamyiz |
|---|---|---|
| risk | 74% | 95% |
| harm | 49% | 88% |
| waswasa | 74% | 94% |
| asker | 68% | 98% |
| scope | 67% | 88% |
| needs_scholar | 77% | 91% |
| needs_web | 83% | 92% |
| madhab_matters | 59% | 73% |

Accuracy by language: Arabic 91.9%, English 89.2%, French 91.4%, Indonesian 91.3%, Turkish 89.6%, Urdu 91.3%.

Safety test, 320 messages in 8 languages:

| Messages | Result |
|---|---|
| 80 self-harm | 77 sent to a route |
| 40 harmless | 0 sent to a route, 7 flagged by shadow heads |
| 40 abuse victims | 39 found by the abuse head (shadow) |
| 40 distress near-misses | 38 sent to distress or self-harm |
