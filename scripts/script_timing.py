#!/usr/bin/env python3
"""Script timing, the REFERENCE implementation (client-website SPEC §14 "Timing", v1 = words ÷ pace).

The portal's TypeScript module (lib/scripts/timing.ts) must give the same numbers for every case in
lib/scripts/timing.vectors.json; this file is how those vectors are made and checked. Production never runs it.

What counts (the AUDIO column only):
- Spoken words. A hyphenated word counts once ("re-election"); an em dash splits ("district—real" = 2).
- Not read aloud, never counted: anything in ( ) or [ ] (directions, cues), and the non-spoken tracks
  SUPER:, SFX:, MUSIC: up to the next label. Markdown bold markers are ignored.
- Numbers as spoken: "$29M" = 4 (twenty nine million dollars), "2026" = 3, "3:15" = 2, "3:00" = 2 (three o'clock),
  "10–15" = 3 (ten to fifteen), "20th" = 1, "21st" = 2, "50%" = 2, "1,200" = 4, "2.5" = 3, phone numbers digit by
  digit, web addresses = letters ÷ 5 rounded up + "dot com" (gexforsenate.com = 5).
- Blanks: "$___" = 2 words (a number + "dollars") and the result says how many blanks it guessed at.
- Pauses: "(beat)" +1.0 s, "(pause)" +1.5 s, each "…" or "..." +0.5 s.
- Time = words ÷ pace (wpm) × 60 + pauses. A row's time = the larger of its read time and its VIDEO hold; a row with
  neither has no time. The script total is the sum.
"""
from __future__ import annotations

import json
import math
import re
import sys

DEFAULT_WPM = 150
PAUSES = {"beat": 1.0, "pause": 1.5}
ELLIPSIS_S = 0.5
NON_SPOKEN = ("SUPER", "SFX", "MUSIC")


def words_under_1000(n: int) -> int:
    w = 0
    if n >= 100:
        w += 2  # "one hundred"
        n %= 100
    if n == 0:
        return w
    return w + (1 if n < 20 or n % 10 == 0 else 2)


def number_words(n: int) -> int:
    """Spoken English words for a whole number (American, no "and")."""
    if n == 0:
        return 1
    w = 0
    for scale in (10**12, 10**9, 10**6, 10**3):
        if n >= scale:
            w += number_words_small(n // scale) + 1
            n %= scale
    if n:
        w += words_under_1000(n)
    return w


def number_words_small(n: int) -> int:
    return words_under_1000(n) if n < 1000 else number_words(n)


def year_words(y: int) -> int:
    if y % 1000 == 0 and y < 3000:
        return 2  # "two thousand"
    if 2000 < y < 2010:
        return 2 + words_under_1000(y - 2000)  # "two thousand five"
    hi, lo = divmod(y, 100)
    if lo == 0:
        return words_under_1000(hi) + 1  # "nineteen hundred"
    lo_words = 2 if lo < 10 else words_under_1000(lo)  # "oh five" / "twenty six"
    return words_under_1000(hi) + lo_words


def decimal_words(s: str) -> int:
    whole, _, frac = s.replace(",", "").partition(".")
    w = number_words(int(whole)) if whole else 1
    if frac:
        w += 1 + len(frac)  # "point" + digits
    return w


# Order matters: each pattern consumes its text before the next looks.
_PHONE = re.compile(r"\(?\b\d{3}\)?[\s.-]?\d{3}[\s.-]\d{4}\b", re.A)
_URL = re.compile(r"\b(?:https?://)?(?:www\.)?([A-Za-z0-9-]+)\.(com|org|net|gov|edu|us|co|io|tv)\b", re.I | re.A)
_MONEY = re.compile(r"\$(_{2,}|\d[\d,]*(?:\.\d+)?)\s*(M|K|B|million|billion|thousand)?\b", re.I | re.A)
_TIME = re.compile(r"\b(\d{1,2}):(\d{2})\b", re.A)
_RANGE = re.compile(r"\b(\d[\d,]*)\s*[–-]\s*(\d[\d,]*)\b", re.A)
_PERCENT = re.compile(r"\b(\d[\d,]*(?:\.\d+)?)%", re.A)
_ORDINAL = re.compile(r"\b(\d[\d,]*)(st|nd|rd|th)\b", re.I | re.A)
_YEAR = re.compile(r"\b(1[1-9]\d\d|20\d\d)\b", re.A)
_NUMBER = re.compile(r"\b\d[\d,]*(?:\.\d+)?\b", re.A)
_WORD = re.compile(r"[A-Za-z0-9_’']+(?:[-’'][A-Za-z0-9_]+)*", re.A)
_BRACKETS = re.compile(r"\([^()]*\)|\[[^\[\]]*\]")
# A label is ALL CAPS ("NARRATOR:", "SUPER:", "MIKE (O/C):") or a name carrying a delivery mark ("Maria (O/C):").
# A plain capitalised word before a colon ("Remember: vote") is ordinary copy and is counted.
_LABEL = re.compile(
    r"(^|\s)((?:[A-Z][A-Z.'\-]+(?: [A-Z][A-Z.'\-]+)*(?: \((?:O/C|VO|OC|V\.O\.|O\.C\.)\))?)"
    r"|(?:[A-Z][a-z]+(?: [A-Z][a-z]+)? \((?:O/C|VO|OC|V\.O\.|O\.C\.)\))):(?=\s|$)",
    re.A,
)


def _strip_tracks(text: str) -> str:
    """Drop SUPER:/SFX:/MUSIC: segments (up to the next label); keep speakers' words, drop their labels."""
    out, keep, pos = [], True, 0
    for m in _LABEL.finditer(text):
        if keep:
            out.append(text[pos:m.start(2)])
        label = m.group(2).strip().upper()
        keep = label not in NON_SPOKEN
        pos = m.end()
    if keep:
        out.append(text[pos:])
    return " ".join(out)


def time_text(text: str) -> dict:
    """{words, pauses_s, blanks} for one AUDIO text."""
    # Markdown bold (**) only: underscores are the client's blanks ("$___"), never formatting. Every Unicode space
    # becomes a plain space first, so this and the JavaScript port agree on what "\\s" means.
    t = re.sub(r"\s", " ", text.replace("**", ""))
    words = 0
    blanks = 0
    pauses = 0.0

    # Pauses and directions: "(beat)" etc. add time; anything else in ( ) or [ ] is never read.
    def bracket(m):
        nonlocal pauses
        inner = m.group(0)[1:-1].strip().lower()
        pauses += PAUSES.get(inner, 0.0)
        return " "
    # Phone numbers first: "(859) 512-1419" is read, not a direction.
    def phone(m):
        nonlocal words
        words += len(re.sub(r"\D", "", m.group(0)))
        return " "
    t = _PHONE.sub(phone, t)
    # Labels before brackets: "Maria (O/C):" is a label only while its "(O/C)" is still there.
    t = _strip_tracks(t)
    t = _BRACKETS.sub(bracket, t)

    n_ellipses = len(re.findall(r"…|\.\.\.", t))
    pauses += n_ellipses * ELLIPSIS_S
    t = re.sub(r"…|\.\.\.", " ", t)

    def url(m):
        nonlocal words
        words += math.ceil(len(m.group(1)) / 5) + 2
        return " "
    t = _URL.sub(url, t)

    def money(m):
        nonlocal words, blanks
        amount, scale = m.group(1), m.group(2)
        if amount.startswith("_"):
            blanks += 1
            words += 1  # the unknown number
        else:
            words += decimal_words(amount)
        words += (1 if scale else 0) + 1  # "million" + "dollars"
        return " "
    t = _MONEY.sub(money, t)

    def clock(m):
        nonlocal words
        h, mi = int(m.group(1)), int(m.group(2))
        words += number_words(h) + (1 if mi == 0 else (1 + 1 if mi < 10 else words_under_1000(mi)))
        return " "
    t = _TIME.sub(clock, t)

    def rng(m):
        nonlocal words
        words += decimal_words(m.group(1)) + 1 + decimal_words(m.group(2))  # "ten to fifteen"
        return " "
    t = _RANGE.sub(rng, t)

    def pct(m):
        nonlocal words
        words += decimal_words(m.group(1)) + 1
        return " "
    t = _PERCENT.sub(pct, t)

    def ordinal(m):
        nonlocal words
        words += number_words(int(m.group(1).replace(",", "")))
        return " "
    t = _ORDINAL.sub(ordinal, t)

    def year(m):
        nonlocal words
        words += year_words(int(m.group(1)))
        return " "
    t = _YEAR.sub(year, t)

    def number(m):
        nonlocal words
        words += decimal_words(m.group(0))
        return " "
    t = _NUMBER.sub(number, t)

    t = t.replace("—", " ").replace("–", " ")
    words += len(_WORD.findall(t))
    return {"words": words, "pauses_s": round(pauses, 3), "blanks": blanks}


def time_rows(rows: list[dict], wpm: int = DEFAULT_WPM) -> dict:
    """rows: [{audio: [{text}], hold_s?}] → per-row seconds (None = no time set) and the total."""
    out, total, words, blanks, untimed = [], 0.0, 0, 0, 0
    for r in rows:
        w, p, b = 0, 0.0, 0
        for a in r.get("audio") or []:
            x = time_text(a.get("text") or "")
            w, p, b = w + x["words"], p + x["pauses_s"], b + x["blanks"]
        read = w / wpm * 60 + p if (w or p) else None
        hold = r.get("hold_s")
        secs = max(read or 0.0, hold or 0.0) if (read is not None or hold) else None
        if secs is None:
            untimed += 1
        else:
            total += secs
        words, blanks = words + w, blanks + b
        out.append({"words": w, "seconds": None if secs is None else round(secs, 3)})
    return {"rows": out, "words": words, "blanks": blanks, "untimed_rows": untimed, "total_s": round(total, 3)}


def clock(seconds: float) -> str:
    s = int(math.floor(seconds + 0.5))
    return f"{s // 60}:{s % 60:02d}"


def label(total_s: float, target_s: int | None, blanks: int = 0) -> str:
    """'0:28 of :30', '0:34 of :30 · 4 s over', '0:57 · no target set', 'about 0:52 … · 2 blanks'."""
    prefix = "about " if blanks else ""
    tail = f" · {blanks} blank{'s' if blanks != 1 else ''}" if blanks else ""
    if not target_s:
        return f"{prefix}{clock(total_s)} · no target set{tail}"
    over = int(math.floor(total_s + 0.5)) - target_s
    tgt = f":{target_s:02d}" if target_s < 60 else clock(target_s)
    return f"{prefix}{clock(total_s)} of {tgt}" + (f" · {over} s over" if over > 0 else "") + tail


if __name__ == "__main__":
    data = json.load(sys.stdin)
    res = time_rows(data["rows"], data.get("wpm", DEFAULT_WPM))
    res["label"] = label(res["total_s"], data.get("target_s"), res["blanks"])
    json.dump(res, sys.stdout, indent=2)
    print()
