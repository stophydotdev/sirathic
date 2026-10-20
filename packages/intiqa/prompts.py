"""Shared text for Sirathic Rerank: the reranker's input format, passage
trimming with the Qwen3 tokenizer, and the judge prompts used for test and
training labels (Opus 5.5 and Qwen3 235B see the same rubric).
"""

import json
import os
from functools import lru_cache
from pathlib import Path

import regex as re

ROOT = Path(__file__).resolve().parent
os.environ.setdefault("HF_HOME", str(ROOT / "hf"))

MODEL_ID = "Qwen/Qwen3-Reranker-0.6B"
DOC_TOKENS = 1024
QUERY_TOKENS = 256
INSTRUCTION = "Given an Islamic question, does this passage answer it?"
PREFIX = ('<|im_start|>system\nJudge whether the Document meets the requirements based on the Query and the '
          'Instruct provided. Note that the answer can only be "yes" or "no".<|im_end|>\n<|im_start|>user\n')
SUFFIX = "<|im_end|>\n<|im_start|>assistant\n<think>\n\n</think>\n\n"

LANGS = {
    "en": "English", "ar": "Arabic (Modern Standard Arabic, Arabic script)", "ur": "Urdu (Urdu script)",
    "id": "Indonesian", "tr": "Turkish", "fr": "French", "bn": "Bengali", "es": "Spanish",
}


@lru_cache(maxsize=1)
def tokenizer():
    from huggingface_hub import snapshot_download
    from tokenizers import Tokenizer

    path = snapshot_download(MODEL_ID, allow_patterns=["tokenizer.json"])
    return Tokenizer.from_file(os.path.join(path, "tokenizer.json"))


def trim(text: str, max_tokens: int) -> str:
    text = re.sub(r"[ \t]+", " ", re.sub(r"\n{3,}", "\n\n", text)).strip()
    enc = tokenizer().encode(text, add_special_tokens=False)
    if len(enc.ids) <= max_tokens:
        return text
    end = enc.offsets[max_tokens - 1][1]
    return text[:end] + "…"


def doc_text(text: str) -> str:
    """The passage exactly as the reranker and the judges see it."""
    return trim(text, DOC_TOKENS)


def query_text(query: str) -> str:
    return trim(query, QUERY_TOKENS)


def pair_text(query: str, doc: str, instruction: str = INSTRUCTION) -> str:
    return f"{PREFIX}<Instruct>: {instruction}\n<Query>: {query}\n<Document>: {doc}{SUFFIX}"


GRADE_SYSTEM = """You grade search results for an Islamic question-answering engine. A user asked a question; a search returned passages (fatwas and articles, hadiths, Quran verses with tafsir, or passages from classical fiqh books, in any language). Grade how useful each passage is for answering THIS question:

3 = answers it: the passage itself gives the answer the user wants (the ruling or explanation they ask about; or, if they ask for a verse or hadith, that verse or hadith).
2 = relevant evidence: does not fully answer, but contains material a scholar would cite or use in this answer: a proof text, a closely related ruling, a partial answer, or one school's position.
1 = same topic only: about the same general subject, but would not help answer this specific question.
0 = unrelated.

Rules:
- Judge only the passage text shown; it may be cut off.
- The passage's language does not matter.
- Shared keywords alone earn nothing.
- A clear ruling on exactly the question is a 3 even if other scholars disagree with it.
- Grade every passage on its own; several passages, or none, may deserve a 3."""

GRADE_SCHEMA = {
    "type": "object",
    "properties": {
        "grades": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {"id": {"type": "string"}, "grade": {"type": "integer"}},
                "required": ["id", "grade"],
                "additionalProperties": False,
            },
        }
    },
    "required": ["grades"],
    "additionalProperties": False,
}


def grade_user(question: str, passages: list[tuple[str, str]]) -> str:
    blocks = "\n\n".join(f"[{pid}]\n{text}" for pid, text in passages)
    return (f"Question: {question}\n\nPassages:\n\n{blocks}\n\n"
            f"Return JSON with a grade (0-3) for every passage id: "
            '{"grades": [{"id": "p1", "grade": 2}, ...]}')


def parse_grades(out, ids: list[str]) -> dict[str, int] | None:
    """Accepts parsed JSON or raw text; returns {pid: grade} only if every id is graded."""
    if isinstance(out, str):
        m = re.search(r"\{.*\}", out, re.S)
        if not m:
            return None
        try:
            out = json.loads(m.group(0))
        except json.JSONDecodeError:
            return None
    if not isinstance(out, dict):
        return None
    grades = {}
    for g in out.get("grades", []):
        try:
            pid, grade = str(g["id"]).strip("[] "), int(g["grade"])
        except (KeyError, TypeError, ValueError):
            continue
        if pid in ids and 0 <= grade <= 3:
            grades[pid] = grade
    return grades if set(grades) == set(ids) else None


QUESTION_SYSTEM = ("You write realistic test questions for evaluating search in an Islamic question-answering "
                   "app. Its users are ordinary Muslims typing into a chat box, in many languages.")

QUESTION_SCHEMA = {
    "type": "object",
    "properties": {"skip": {"type": "boolean"}, "question": {"type": "string"}},
    "required": ["skip", "question"],
    "additionalProperties": False,
}

KIND_HINT = {
    "fatwa": "a fatwa or article",
    "hadith": "a hadith",
    "quran": "a Quran verse with a short tafsir",
    "fiqh": "a passage from a classical fiqh book",
}
ASK_HINT = {
    "fatwa": "that this passage answers",
    "hadith": ("whose answer would quote or rely on this hadith (for example what the Prophet ﷺ said or did "
               "about something, or a practical ruling this hadith settles)"),
    "quran": ("whose answer would quote this verse (for example what the Quran says about something, or which "
              "verse mentions it)"),
    "fiqh": "that this passage answers (a practical fiqh ruling)",
}


def question_user(source: str, lang: str, passage: str) -> str:
    return f"""Language: {LANGS[lang]}
Source type: {KIND_HINT[source]}

Passage:
<<<
{passage}
>>>

Write ONE question in {LANGS[lang]} that a real user might ask, {ASK_HINT[source]}.
Rules:
- Sound like a real person: short (5 to 25 words), natural, the way people type. No greeting.
- Do not copy distinctive phrases from the passage. Do not name the source, book, scholar, website, verse number or hadith number.
- The passage must answer the question, but keep the question general enough that other passages could answer it too.
- If the passage cannot answer any realistic question (only a chain of narrators, a fragment, an index, a biography, an announcement), set skip to true.
Return JSON: {{"skip": false, "question": "..."}}"""
