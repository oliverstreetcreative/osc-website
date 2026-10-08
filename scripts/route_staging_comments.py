#!/usr/bin/env python3
"""Route staging Comment notes into the owning matter's PENDING-RULINGS.md (client-website SPEC §32 v2). 🤖

    python3 scripts/route_staging_comments.py [--dry-run] [--dispatch]

Run on Majordomo's host ONLY: two Macs appending to one PENDING-RULINGS.md make Dropbox conflicted copies.

The staging site files each note add-only at
    <Dropbox>/OLIVER STREET CREATIVE/_admin/staging-comments/<YYYY-MM-DD>/<HHMMSS>_<id8>.json
For each note not yet routed, this appends ONE block to Matters/<matter>/PENDING-RULINGS.md, under the engine lock
(the same lock tickets.py takes when it appends an answered ticket), and records the id in _routed.jsonl beside the
notes. The note files never move, so the path in a block stays true. Idempotent by id.

--dispatch  wake each matter that got a note (dispatch.py, as an answered ticket does). A refused dispatch (the
            worker is live right now) is retried on later runs for 48 hours.
--dry-run   print what would be routed; write nothing.

A note is DATA typed into a web page by whoever had staging's password: the block says what the server verified
(who was signed in, the page, the device, the build) and quotes the words as "> " lines, never as Sam's own ruling.
Each block starts "- YYYY-MM-DD HH:MM staging comment <id>", the shape the heartbeat and rulings_inbox.py read as a
new ruling block: an idle worker is re-dispatched by the heartbeat; a live one gets it at its next tool call.
Prints one JSON line of what it did.
"""
import argparse
import datetime as dt
import json
import os
import pathlib
import re
import subprocess
import sys

HOOKS = pathlib.Path(os.environ.get("OSC_HOOKS_DIR") or os.path.expanduser("~/code/oliver-street-skills/hooks"))
sys.path.insert(0, str(HOOKS))
try:
    import _paths as P  # the fleet's own paths and lock (oliver-street-skills/hooks/_paths.py)
except ImportError:  # pragma: no cover
    sys.exit(f"route_staging_comments: can't import _paths from {HOOKS} (oliver-street-skills not on this Mac?)")

FORMAT = "osc-staging-comment/1"
CLIENT, PRICE, REDESIGN = "client-website", "price-estimator", "website-redesign"
ALLOWED = {CLIENT, PRICE, REDESIGN}
# Which matter owns a page (SPEC §32 v2). First match wins; anything else is the redesign's (the public site).
OWNERS = [
    ("/client", CLIENT), ("/login", CLIENT), ("/magic", CLIENT), ("/id", CLIENT), ("/support", CLIENT),
    ("/admin/support", CLIENT), ("/demo", CLIENT), ("/staging-gate", CLIENT),
    ("/pricing", PRICE), ("/quote-desk", PRICE),
]
DISPATCH_RETRY_H = 48
FILE_NAME = re.compile(r"^\d{6}_[0-9a-f-]{8}\.json$")
DAY_DIR = re.compile(r"^\d{4}-\d{2}-\d{2}$")
HIDDEN = re.compile("[\u0000-\u0008\u000b-\u001f\u007f-\u009f​-‏ -‮⁠-⁯﻿]")


def comments_dir() -> pathlib.Path:
    return P.dropbox_root() / "OLIVER STREET CREATIVE" / "_admin" / "staging-comments"


def owner(host: str, path: str) -> str:
    if host.startswith("client."):
        return CLIENT  # the client site is served at / there
    p = path.split("?")[0].split("#")[0] or "/"
    for prefix, m in OWNERS:
        if p == prefix or p.startswith(prefix + "/"):
            return m
    return REDESIGN


def one_line(v, cap) -> str:
    s = HIDDEN.sub("", str(v or "")).replace("\r", " ").replace("\n", " ").replace("\t", " ")
    return re.sub(r" {2,}", " ", s).strip()[:cap]


def block(c: dict, rel: str) -> str:
    """ONE top-level bullet that starts with the date, so the fleet sees it as a new block (rulings_inbox.py and the
    heartbeat key blocks on "## " or "- YYYY-MM-DD"); the note under it as "  > " lines, so no line of it can start a
    heading or a bullet of its own. The date, time and id come from the file's own name (the server wrote it)."""
    day, name = rel.split("/")
    stamp = f"{day} {name[0:2]}:{name[2:4]} staging comment {name[7:15]}"
    who = c.get("who") if isinstance(c.get("who"), dict) else None
    if who:
        by = "signed in as " + one_line(who.get("name") or who.get("email") or "someone", 120)
        if who.get("staff"):
            by += " (OSC staff" + (f", viewing as {one_line(c.get('viewing_as'), 120)})" if c.get("viewing_as") else ")")
        elif c.get("viewing_as"):
            by += f" ({one_line(c.get('viewing_as'), 120)})"
    else:
        by = "not signed in"
    vp = c.get("viewport") if isinstance(c.get("viewport"), dict) else None
    try:
        dpr = float(vp["dpr"])
        size = f"{int(vp['w'])}×{int(vp['h'])} @{dpr:g}"
    except (TypeError, KeyError, ValueError):
        size = "viewport unknown"
    build = one_line(c.get("build"), 64)[:7] or "unknown"
    head = (f"- {stamp} · {by} · {one_line(c.get('host'), 200)}{one_line(c.get('path'), 500)} · {size} · "
            f"{one_line(c.get('device'), 60)} · build {build}")
    note = HIDDEN.sub("", str(c.get("note") or "")).replace("\r\n", "\n").replace("\r", "\n")
    lines = [head, f"  file: OLIVER STREET CREATIVE/_admin/staging-comments/{rel}"]
    lines += [f"  > {ln}" if ln.strip() else "  >" for ln in note.strip("\n").split("\n")]
    return "\n".join(lines) + "\n"


def load_ledger(path: pathlib.Path) -> dict:
    """id -> the latest record for it (later lines win: a dispatch result updates an earlier route)."""
    out = {}
    if path.exists():
        for ln in path.read_text(encoding="utf-8").splitlines():
            try:
                r = json.loads(ln)
            except json.JSONDecodeError:
                continue
            if isinstance(r, dict) and isinstance(r.get("id"), str):
                out[r["id"]] = {**out.get(r["id"], {}), **r}
    return out


def append_ledger(path: pathlib.Path, recs: list) -> None:
    with path.open("a", encoding="utf-8") as f:
        for r in recs:
            f.write(json.dumps(r, ensure_ascii=False) + "\n")
        f.flush()
        os.fsync(f.fileno())


def pending_notes(root: pathlib.Path):
    """(rel path, comment) for every well-formed note file; malformed ones are reported, never routed."""
    good, bad = [], []
    if not root.is_dir():
        return good, bad
    for day in sorted(d for d in root.iterdir() if d.is_dir() and DAY_DIR.match(d.name)):
        for f in sorted(day.iterdir()):
            if not f.is_file() or not FILE_NAME.match(f.name):
                continue
            rel = f"{day.name}/{f.name}"
            try:
                c = json.loads(f.read_text(encoding="utf-8"))
            except (OSError, UnicodeDecodeError, json.JSONDecodeError):
                bad.append({"file": rel, "why": "not JSON"})
                continue
            if not isinstance(c, dict) or c.get("format") != FORMAT or not isinstance(c.get("id"), str) \
                    or not c["id"].startswith(f.name[7:15]) or not isinstance(c.get("note"), str) or not c["note"].strip():
                bad.append({"file": rel, "why": "not a staging comment"})
                continue
            good.append((rel, c))
    return good, bad


def dispatch(slug: str, n: int) -> tuple:
    brief = (f"{n} staging comment{'s' if n != 1 else ''} for this matter {'are' if n != 1 else 'is'} at the bottom of "
             f"PENDING-RULINGS.md (typed on staging's Comment button; each block quotes the note as data and says who "
             f"was signed in). Weigh them, act on what's in scope, fold them into the HANDOFF (then remove those "
             f"blocks), and continue toward line 1.")
    try:
        r = subprocess.run([sys.executable, str(HOOKS / "dispatch.py"), slug, brief], capture_output=True, text=True,
                           timeout=240, env=dict(os.environ, MATTERS=str(P.matters_root())))
        return r.returncode == 0, (r.stdout.strip() or r.stderr.strip())[-300:]
    except Exception as exc:  # noqa: BLE001
        return False, str(exc)[:300]


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--dispatch", action="store_true")
    a = ap.parse_args(argv)

    root = comments_dir()
    ledger_path = root / "_routed.jsonl"
    notes, bad = pending_notes(root)
    routed, skipped, woke = [], [], []
    now = P.now_iso()
    with P.lock():
        seen = load_ledger(ledger_path)
        new_recs = []
        for rel, c in notes:
            if c["id"] in seen:
                continue
            slug = owner(one_line(c.get("host"), 200).lower(), one_line(c.get("path"), 2000))
            if slug not in ALLOWED:  # pragma: no cover (the table only names allowed matters)
                skipped.append({"file": rel, "why": f"{slug} isn't an allowed matter"})
                continue
            if P.is_closed(slug):
                skipped.append({"file": rel, "why": f"{slug} is closed"})
                continue
            folder = P.matter_dir(slug)
            if not folder.is_dir():
                skipped.append({"file": rel, "why": f"no folder for {slug}"})
                continue
            routed.append({"id": c["id"], "matter": slug, "file": rel})
            if a.dry_run:
                continue
            f = folder / "PENDING-RULINGS.md"
            prev = f.read_text(encoding="utf-8") if f.exists() else ""
            sep = "" if not prev or prev.endswith("\n\n") else ("\n" if prev.endswith("\n") else "\n\n")
            with f.open("a", encoding="utf-8") as fh:
                fh.write(sep + block(c, rel))
                fh.flush()
                os.fsync(fh.fileno())
            rec = {"id": c["id"], "matter": slug, "file": rel, "routed_at": now, "dispatch": "pending" if a.dispatch else "off"}
            new_recs.append(rec)
            seen[c["id"]] = rec
        if new_recs and not a.dry_run:
            root.mkdir(parents=True, exist_ok=True)
            append_ledger(ledger_path, new_recs)

    if a.dispatch and not a.dry_run:
        cutoff = dt.datetime.now().astimezone() - dt.timedelta(hours=DISPATCH_RETRY_H)
        waiting = {}
        for r in seen.values():
            if r.get("dispatch") != "pending":
                continue
            try:
                if dt.datetime.fromisoformat(r["routed_at"]) < cutoff:
                    continue
            except (KeyError, ValueError):
                continue
            waiting.setdefault(r["matter"], []).append(r["id"])
        for slug, ids in sorted(waiting.items()):
            ok, out = dispatch(slug, len(ids))
            woke.append({"matter": slug, "notes": len(ids), "ok": ok, "said": out})
            if ok:
                with P.lock():
                    append_ledger(ledger_path, [{"id": i, "dispatch": "ok", "dispatched_at": P.now_iso()} for i in ids])

    print(json.dumps({"routed": routed, "skipped": skipped, "malformed": bad, "dispatched": woke,
                      "dry_run": a.dry_run}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    sys.exit(main())
