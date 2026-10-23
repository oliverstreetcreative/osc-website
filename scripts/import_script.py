#!/usr/bin/env python3
"""Script importer (client-website SPEC §14 v4, decision 4: "Imports are the client's exact words").

Turns a CANONICAL script source into the portal's import format, rows of VIDEO | AUDIO, without changing a
single word the client wrote. Every difference between the canonical text and the PROMPTER file Sam reads from
(a fixed typo, a blank closed up, a speaker label) comes in as an attributed SUGGESTION, so the client sees each
fix and accepts or rejects it; nothing is silently fixed. The test suite proves that accepting every suggestion
reproduces the PROMPTER file exactly.

Adapters, one per real source shape (each states its rules and refuses a file that doesn't fit them):
  harmon-texted   Mike Harmon's script as texted ("... Script:" then paragraphs; a trailing "( ... )" is a
                  delivery note; a final "Logo ..." paragraph is the end card, VIDEO only)
  gex-snapshot    the 8/28 snapshot of Sebastian's Google Doc (its provenance header is dropped; "# Script: <spot>"
                  sections; "1. Judy: (Close up) words" rows; "[Cut to ...]" cues are the next row's VIDEO)

Normalisation, the only one: trailing spaces at the end of a line are dropped and blank lines separate paragraphs.
Each row keeps its exact source paragraph in `source`.

Output: JSON, format "osc-script-import/1" (consumed by the portal's staff-only import endpoint):
  {format, adapter, title, source: {path, sha256, label}, rows: [{video: [str], audio: [{speaker, text}],
   directions: [str], source}], suggestions: [{row, field: "audio"|"speaker", start, end, replace, author,
   note}], dropped: [{text, why}]}
Ranges are character offsets (Python str = code points) into that row's first audio text or speaker label.

Usage:
  python3 scripts/import_script.py harmon-texted "<path>" --title "Harmon SoS" [--prompter "<path>"] [--out x.json]
  python3 scripts/import_script.py gex-snapshot "<path>" --spot Family --title "Family" [--prompter "<path>"]
"""
from __future__ import annotations

import argparse
import difflib
import hashlib
import json
import re
import sys
from pathlib import Path

FORMAT = "osc-script-import/1"


class ImportRefused(ValueError):
    """The source doesn't fit the adapter's rules; nothing is imported."""


def _paragraphs(text: str) -> list[str]:
    """Blank-line separated paragraphs; the ONLY normalisation is dropping trailing spaces on each line."""
    lines = [line.rstrip(" \t") for line in text.replace("\r\n", "\n").replace("\r", "\n").split("\n")]
    paras, cur = [], []
    for line in lines:
        if line.strip() == "":
            if cur:
                paras.append("\n".join(cur))
                cur = []
        else:
            cur.append(line)
    if cur:
        paras.append("\n".join(cur))
    return paras


def _row(audio_text: str | None, speaker: str | None = None, video: list[str] | None = None,
         directions: list[str] | None = None, source: str = "") -> dict:
    return {
        "video": list(video or []),
        "audio": [{"speaker": speaker, "text": audio_text}] if audio_text is not None else [],
        "directions": list(directions or []),
        "source": source,
    }


def _source(path: Path, label: str) -> dict:
    data = path.read_bytes()
    return {"path": str(path), "sha256": hashlib.sha256(data).hexdigest(), "label": label}


# ------------------------------------------------------------------ harmon-texted

_TRAILING_NOTE = re.compile(r"^(?P<text>.*?\S)\s*\((?P<note>[^()]+)\)$", re.S)


def harmon_texted(path: Path, title: str) -> dict:
    raw = path.read_bytes().decode("utf-8")
    paras = _paragraphs(raw)
    try:
        start = paras.index("Script:")
    except ValueError:
        raise ImportRefused('harmon-texted: no "Script:" line, so the script can\'t be told from the message around it')
    dropped = [{"text": p, "why": "the text message around the script, not the script"} for p in paras[: start + 1]]
    body = paras[start + 1:]
    if not body:
        raise ImportRefused("harmon-texted: nothing after Script:")
    rows = []
    for i, para in enumerate(body):
        last = i == len(body) - 1
        if last and para.startswith("Logo"):
            # The deliverable "ends on the logo and 'Paid for by Mike Harmon'": the end card, on screen.
            rows.append(_row(None, video=[para], source=para))
            continue
        m = _TRAILING_NOTE.match(para)
        if m:
            rows.append(_row(m.group("text"), directions=[m.group("note")], source=para))
        else:
            rows.append(_row(para, source=para))
    return {"format": FORMAT, "adapter": "harmon-texted", "title": title,
            "source": _source(path, "Mike's script as texted (CURRENT)"), "rows": rows, "suggestions": [],
            "dropped": dropped}


# ------------------------------------------------------------------ gex-snapshot

_SPOT = re.compile(r"^# Script: (?P<name>.+)$")
_NUMBER = re.compile(r"^(?P<n>\d+)\.\s+")
_SPEAKER = re.compile(r"^(?P<who>[A-Z][A-Za-z.'\- ]{0,40}?):\s+")
_DIRECTION = re.compile(r"^\((?P<d>[^()]+)\)\s*")
_CUE = re.compile(r"^\[(?P<cue>[^\[\]]+)\]$")


def gex_snapshot(path: Path, spot: str, title: str) -> dict:
    raw = path.read_bytes().decode("utf-8")
    lines = raw.replace("\r\n", "\n").split("\n")
    try:
        cut = lines.index("---")
    except ValueError:
        raise ImportRefused("gex-snapshot: no '---' line after the snapshot's own header")
    body_lines = lines[cut + 1:]
    sections: dict[str, list[str]] = {}
    current = None
    for line in body_lines:
        m = _SPOT.match(line.rstrip())
        if m:
            current = m.group("name").strip()
            sections[current] = []
        elif current is not None:
            sections[current].append(line)
    if spot not in sections:
        raise ImportRefused(f"gex-snapshot: no '# Script: {spot}' section (found: {', '.join(sections) or 'none'})")
    paras = _paragraphs("\n".join(sections[spot]))
    rows, pending_cue, speaker = [], None, None
    for para in paras:
        cue = _CUE.match(para)
        if cue:
            if pending_cue is not None:
                raise ImportRefused(f"gex-snapshot: two cues in a row before a line ({pending_cue!r}, {cue.group('cue')!r})")
            pending_cue = cue.group("cue")
            continue
        rest = para
        numbered = _NUMBER.match(rest)
        if numbered:
            rest = rest[numbered.end():]
        who = _SPEAKER.match(rest)
        if who:
            speaker = who.group("who").strip()
            rest = rest[who.end():]
        elif numbered:
            speaker = None  # a new numbered item with no name: nobody carries over
        video = []
        d = _DIRECTION.match(rest)
        if d:
            video.append(d.group("d"))
            rest = rest[d.end():]
        if pending_cue is not None:
            video.insert(0, pending_cue)
            pending_cue = None
        if not rest.strip():
            raise ImportRefused(f"gex-snapshot: a row with no words: {para!r}")
        rows.append(_row(rest, speaker=speaker, video=video, source=para))
    if pending_cue is not None:
        raise ImportRefused(f"gex-snapshot: a cue with no line after it: {pending_cue!r}")
    return {"format": FORMAT, "adapter": "gex-snapshot", "title": title,
            "source": _source(path, "from the 8/28 copy of Sebastian's Google Doc (the Doc wins)"),
            "rows": rows, "suggestions": [], "dropped": [{"text": "\n".join(lines[: cut + 1]).strip(),
                                                          "why": "the snapshot's own provenance header"}]}


# ------------------------------------------------------------------ prompter → suggestions

_TOKEN = re.compile(r"\s+|[^\s]+")
_LABEL_LINE = re.compile(r"^(?P<who>[A-Z][A-Za-z.'\- ]{0,40}?(?: \([A-Z/.]+\))?):$")


def _token_spans(s: str) -> list[tuple[int, int, str]]:
    return [(m.start(), m.end(), m.group(0)) for m in _TOKEN.finditer(s)]


def _diff_ranges(old: str, new: str) -> list[tuple[int, int, str]]:
    """Word-level differences as (start, end, replacement) ranges over `old`."""
    a, b = _token_spans(old), _token_spans(new)
    sm = difflib.SequenceMatcher(a=[t[2] for t in a], b=[t[2] for t in b], autojunk=False)
    out = []
    for op, i1, i2, j1, j2 in sm.get_opcodes():
        if op == "equal":
            continue
        start = a[i1][0] if i1 < len(a) else len(old)
        end = a[i2 - 1][1] if i2 > i1 else start
        out.append((start, end, "".join(t[2] for t in b[j1:j2])))
    return out


def add_prompter_suggestions(doc: dict, prompter: Path, author: str, note: str) -> dict:
    """Align the rows that have words with the PROMPTER's paragraphs and record every difference as a suggestion."""
    paras = _paragraphs(prompter.read_bytes().decode("utf-8"))
    spoken = [i for i, r in enumerate(doc["rows"]) if r["audio"]]
    if len(spoken) != len(paras):
        raise ImportRefused(f"prompter: {len(paras)} paragraphs but {len(spoken)} spoken rows; can't line them up")
    suggestions = []
    for row_i, para in zip(spoken, paras):
        audio = doc["rows"][row_i]["audio"][0]
        label = None
        first, _, remainder = para.partition("\n")
        m = _LABEL_LINE.match(first)
        if m and remainder:
            label, para = m.group("who"), remainder
        if label is not None and label != (audio["speaker"] or ""):
            for start, end, rep in _diff_ranges(audio["speaker"] or "", label):
                suggestions.append({"row": row_i, "field": "speaker", "start": start, "end": end, "replace": rep,
                                    "author": author, "note": note})
        for start, end, rep in _diff_ranges(audio["text"], para):
            suggestions.append({"row": row_i, "field": "audio", "start": start, "end": end, "replace": rep,
                                "author": author, "note": note})
    doc["suggestions"] = suggestions
    return doc


def apply_suggestions(doc: dict) -> list[dict]:
    """Rows as they read once every suggestion is accepted (tests, and the importer's own self-check)."""
    rows = json.loads(json.dumps(doc["rows"]))
    by_target: dict[tuple[int, str], list[dict]] = {}
    for s in doc["suggestions"]:
        by_target.setdefault((s["row"], s["field"]), []).append(s)
    for (row_i, field), items in by_target.items():
        audio = rows[row_i]["audio"][0]
        key = "text" if field == "audio" else "speaker"
        value = audio[key] or ""
        for s in sorted(items, key=lambda x: x["start"], reverse=True):
            value = value[: s["start"]] + s["replace"] + value[s["end"]:]
        audio[key] = value
    return rows


def prompter_text(rows: list[dict]) -> str:
    """The Prompter .txt export of rows (AUDIO only; a speaker label on its own line when the row has one AND the
    label carries a delivery mark like (VO); plain names are context, not read)."""
    out = []
    for r in rows:
        if not r["audio"]:
            continue
        a = r["audio"][0]
        sp = a["speaker"] or ""
        out.append(f"{sp}:\n{a['text']}" if re.search(r"\((VO|O/C|OC|V\.O\.)\)$", sp) else a["text"])
    return "\n\n".join(out) + "\n"


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("adapter", choices=["harmon-texted", "gex-snapshot"])
    ap.add_argument("source")
    ap.add_argument("--title", required=True)
    ap.add_argument("--spot", help="gex-snapshot: which '# Script: <spot>' section")
    ap.add_argument("--prompter", help="a PROMPTER .txt whose differences come in as suggestions")
    ap.add_argument("--author", default="Sam (prompter fix)")
    ap.add_argument("--out")
    a = ap.parse_args(argv)
    try:
        if a.adapter == "harmon-texted":
            doc = harmon_texted(Path(a.source), a.title)
        else:
            if not a.spot:
                ap.error("--spot is required for gex-snapshot")
            doc = gex_snapshot(Path(a.source), a.spot, a.title)
        if a.prompter:
            doc = add_prompter_suggestions(doc, Path(a.prompter), a.author, f"from {Path(a.prompter).name}")
    except ImportRefused as e:
        print(f"refused: {e}", file=sys.stderr)
        return 2
    text = json.dumps(doc, ensure_ascii=False, indent=2) + "\n"
    if a.out:
        Path(a.out).write_text(text, encoding="utf-8")
    else:
        sys.stdout.write(text)
    return 0


if __name__ == "__main__":
    sys.exit(main())
