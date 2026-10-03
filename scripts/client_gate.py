#!/usr/bin/env python3
"""The client-site PUBLISH GATE (Sam 10/3 00:55): nothing reaches a client page
until Sam has approved exactly what the client will see.

Folders (Dropbox, OLIVER STREET CREATIVE/_admin/client-site/):
  books/<org>.json      DRAFTS. Workers write these. The site never reads them.
  published/<org>.json  LIVE. Only this tool writes them, only on Sam's approval.
                        The site syncs this folder and nothing else.
  preview/<org>--preview.json
                        Published + every pending draft item, for staff to look at
                        in "View as client" before Sam decides. No people (nobody
                        can sign in to it), invoice numbers marked "(preview)".
  published/_log/<org>.jsonl
                        Every approval and removal: who, when, ticket, items.

Usage (stdlib only; DROPBOX_LOCAL_ROOT overrides the Dropbox path):
  client_gate.py status  <org>            what's new / changed / removed vs live
  client_gate.py lint    <org>            check pending items; non-zero exit on problems
  client_gate.py preview <org>            write the preview book
  client_gate.py ticket  <org>            print the one-screen ticket text for Sam
  client_gate.py approve <org> --by "Sam" --ticket <id> [--items k1,k2]
                                          publish pending items (all by default); refuses if lint fails
  client_gate.py remove  <org> --items k1,k2 --by <who>
                                          take items down now (removal never needs approval)
Item keys: org · person:<email> · project:<key> · film:<project>/<film> · shoot:<project>/<shoot>
           · invoice:<number> · document:<key>
"""
import argparse
import copy
import datetime as dt
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys

ROOT = os.environ.get("DROPBOX_LOCAL_ROOT") or os.path.expanduser(
    "~/Library/CloudStorage/Dropbox/OLIVER STREET CREATIVE")
SITE = os.path.join(ROOT, "_admin", "client-site")
DRAFTS, PUBLISHED, PREVIEW = (os.path.join(SITE, d) for d in ("books", "published", "preview"))
LOG = os.path.join(PUBLISHED, "_log")

# Files every client may receive (OSC vendor paperwork).
SHARED_FILES = {"/_admin/Corporate Docs/W9 Oliver Street Creative_2026.pdf"}
SHARED_PREFIXES = ("/_admin/client-site/",)

# ---------------------------------------------------------------- items

def load(path):
    if not os.path.exists(path):
        return None
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def proposed(book):
    """AUDIENCE SPINE (10/3 01:20): every fact defaults to audience 'office'. In a DRAFT, only items a worker
    marked audience 'client' are offered for publishing; everything else never leaves the office."""
    if not book:
        return book
    b = copy.deepcopy(book)
    keep = lambda x: x.get("audience") == "client"
    if not keep(b.get("org", {})):
        return None
    b["people"] = [p for p in b.get("people", []) if keep(p)]
    b["projects"] = [p for p in b.get("projects", []) if keep(p)]
    for p in b["projects"]:
        p["films"] = [f for f in p.get("films", []) if keep(f)]
        p["shoots"] = [s for s in p.get("shoots", []) if keep(s)]
    b["invoices"] = [i for i in b.get("invoices", []) if keep(i)]
    b["documents"] = [d for d in b.get("documents", []) if keep(d)]
    return b


def flatten(book):
    """Book -> ordered {key: (label, content)}. A project's own item excludes its films and shoots."""
    out = {}
    if not book:
        return out
    out["org"] = ("Client details", book["org"])
    for p in book.get("people", []):
        out[f"person:{p['email'].lower()}"] = (f"Sign-in for {p['name']}", p)
    for p in book.get("projects", []):
        own = {k: v for k, v in p.items() if k not in ("films", "shoots")}
        out[f"project:{p['key']}"] = (f"Project page: {p['title']}", own)
        for f in p.get("films", []):
            out[f"film:{p['key']}/{f['key']}"] = (f"Film: {f['title']}" + (f" ({f['version']})" if f.get("version") else ""), f)
        for s in p.get("shoots", []):
            out[f"shoot:{p['key']}/{s['key']}"] = (f"Filming day: {s.get('label') or s['start']} ({p['title']})", s)
    for i in book.get("invoices", []):
        out[f"invoice:{i['number']}"] = (f"Invoice {i['number']}: {i['title']}", i)
    for d in book.get("documents", []):
        out[f"document:{d['key']}"] = (f"Document: {d['title']}", d)
    return out


def assemble(meta, items, order):
    """Items -> book, in the draft's order. meta = {'version':1}."""
    book = {"version": meta.get("version", 1), "org": None, "people": [], "projects": [], "invoices": [], "documents": []}
    projects = {}
    for key in order:
        if key not in items:
            continue
        content = copy.deepcopy(items[key][1])
        kind, _, rest = key.partition(":")
        if key == "org":
            book["org"] = content
        elif kind == "person":
            book["people"].append(content)
        elif kind == "project":
            content["films"], content["shoots"] = [], []
            projects[content["key"]] = content
            book["projects"].append(content)
        elif kind in ("film", "shoot"):
            pkey = rest.split("/")[0]
            if pkey in projects:  # a film/shoot only shows under a published project
                projects[pkey]["films" if kind == "film" else "shoots"].append(content)
        elif kind == "invoice":
            book["invoices"].append(content)
        elif kind == "document":
            book["documents"].append(content)
    return book


def digest(content):
    return hashlib.sha256(json.dumps(content, sort_keys=True, ensure_ascii=False).encode()).hexdigest()


def diff(slug):
    draft = proposed(load(os.path.join(DRAFTS, f"{slug}.json")))
    live = load(os.path.join(PUBLISHED, f"{slug}.json"))
    d, l = flatten(draft), flatten(live)
    new = [k for k in d if k not in l]
    changed = [k for k in d if k in l and digest(d[k][1]) != digest(l[k][1])]
    removed = [k for k in l if k not in d]
    return draft, live, d, l, new, changed, removed

# ---------------------------------------------------------------- lint

TEXT_BAD = [
    (r"🤖", "machine marker 🤖"),
    (r"\b(PRELIM\w*|INTERNAL|DO NOT (SEND|SHARE))\b", "internal-draft marker"),
    (r"\b(HANDOFF|Majordomo|Asana|Attio|LucidLink|DaVinci|Resolve project|project\.json|PENDING-RULINGS)\b", "internal tool or process name"),
    # ("markup" is left out on purpose: in scripts it means edit marks, as in "Peter's markup".)
    (r"\b(day rate|rate card|margin|crew pay|our cost|bid|budget line|net profit)\b", "money talk"),
    (r"\b(routing number|account number|ABA|SWIFT|IBAN)\b", "bank details"),
]
OSC_PHONE = re.compile(r"\(?859\)?[-. ]?512[-. ]?1419")
PHONE = re.compile(r"\(?\b\d{3}\)?[-. ]\d{3}[-. ]\d{4}\b")
EMAIL = re.compile(r"[\w.+-]+@([\w-]+\.)+[\w-]+")
BAD_FILENAME = re.compile(r"prelim|internal|\bbid\b|_bid|bid_|packet|editor-brief|action-document|budget|crew|rates?\b|deal-memo|transcript", re.I)
TEAM_FRAMEIO = re.compile(r"app\.frame\.io/(projects|player)/", re.I)


def strings(obj):
    if isinstance(obj, str):
        yield obj
    elif isinstance(obj, dict):
        for k, v in obj.items():
            if k in ("path", "url", "watch_url", "review_url", "pay_url", "logo", "poster", "file", "email", "key", "slug", "project_key"):
                continue
            yield from strings(v)
    elif isinstance(obj, list):
        for v in obj:
            yield from strings(v)


def paths(obj):
    if isinstance(obj, dict):
        for k, v in obj.items():
            if k in ("path", "file", "poster", "pdf") and isinstance(v, str):
                yield v
            elif k == "logo" and isinstance(v, str) and not v.startswith("/client-logos/"):
                yield v
            else:
                yield from paths(v)
    elif isinstance(obj, list):
        for v in obj:
            yield from paths(v)


def urls(obj):
    if isinstance(obj, dict):
        for k, v in obj.items():
            if k in ("url", "watch_url", "review_url", "pay_url") and isinstance(v, str):
                yield v
            else:
                yield from urls(v)
    elif isinstance(obj, list):
        for v in obj:
            yield from urls(v)


def pdf_text(path):
    full = os.path.join(ROOT, path.lstrip("/"))
    if not path.lower().endswith(".pdf") or not shutil.which("pdftotext") or not os.path.exists(full):
        return None
    try:
        return subprocess.run(["pdftotext", "-q", full, "-"], capture_output=True, text=True, timeout=60).stdout
    except Exception:
        return None


def text_problems(text, client_domains):
    out = []
    for pat, why in TEXT_BAD:
        m = re.search(pat, text, re.I if why != "machine marker 🤖" else 0)
        if m:
            out.append(f'{why}: "{m.group(0)}"')
    for m in EMAIL.finditer(text):
        dom = m.group(0).split("@")[1].lower()
        if dom != "oliverstreetcreative.com" and dom not in client_domains:
            out.append(f"someone else's email: {m.group(0)}")
    for m in PHONE.finditer(text):
        if not OSC_PHONE.search(m.group(0)):
            out.append(f"a phone number that isn't OSC's: {m.group(0)}")
    return out


def lint_item(key, content, org):
    problems = []
    folder = (org or {}).get("folder")
    domains = {x.lower() for x in (org or {}).get("domains", [])}
    for s in strings(content):
        problems += text_problems(s, domains)
    for p in paths(content):
        name = p.rsplit("/", 1)[-1]
        inside = (folder and p.startswith(folder.rstrip("/") + "/")) or p in SHARED_FILES or p.startswith(SHARED_PREFIXES)
        if not inside:
            problems.append(f"file outside this client's folder: {p}")
        if BAD_FILENAME.search(name):
            problems.append(f"file name looks internal: {name}")
        if not os.path.exists(os.path.join(ROOT, p.lstrip("/"))):
            problems.append(f"file not found: {p}")
        t = None if p in SHARED_FILES else pdf_text(p)  # OSC vendor forms are vetted once; their boilerplate trips the rules
        if t:
            for prob in text_problems(t, domains):
                problems.append(f"inside {name}: {prob}")
    for u in urls(content):
        if not u.startswith("https://"):
            problems.append(f"link isn't https: {u}")
        if TEAM_FRAMEIO.search(u):
            problems.append(f"Frame.io team link, not a client share: {u}")
    if key.startswith("person:") and content.get("email", "").lower().endswith("@oliverstreetcreative.com"):
        problems.append("an OSC address in a client's people list")
    return sorted(set(problems))


def lint(slug, keys=None):
    draft, live, d, l, new, changed, removed = diff(slug)
    keys = keys or (new + changed)
    org = d.get("org", (None, None))[1]
    if org and not org.get("folder"):
        return {"org": ["the book's org needs a 'folder' (its /Clients/... folder) so files can be checked"]}
    return {k: probs for k in keys if k in d for probs in [lint_item(k, d[k][1], org)] if probs}

# ---------------------------------------------------------------- write

def write_json(path, data):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
        f.write("\n")
    os.replace(tmp, path)


def log(slug, entry):
    os.makedirs(LOG, exist_ok=True)
    entry = {"at": dt.datetime.now().astimezone().isoformat(timespec="seconds"), **entry}
    with open(os.path.join(LOG, f"{slug}.jsonl"), "a", encoding="utf-8") as f:
        f.write(json.dumps(entry, ensure_ascii=False) + "\n")


def publish(slug, keys, by, ticket, removing=()):
    draft, live, d, l, *_ = diff(slug)
    items = dict(l)
    for k in keys:
        items[k] = d[k]
    for k in removing:
        items.pop(k, None)
    order = list(d) + [k for k in l if k not in d]
    if "org" not in items:
        raise SystemExit("can't publish anything before the client details (key 'org') are approved")
    book = assemble(draft or live, items, order)
    write_json(os.path.join(PUBLISHED, f"{slug}.json"), book)
    log(slug, {"by": by, "ticket": ticket, "published": list(keys), "removed": list(removing)})
    write_preview(slug)
    return book


def write_preview(slug):
    """A preview exists only while something is waiting for Sam; otherwise it's removed (and the site hides it)."""
    draft, live, d, l, new, changed, removed = diff(slug)
    path = os.path.join(PREVIEW, f"{slug}--preview.json")
    if not d or not (new or changed):
        if os.path.exists(path):
            os.remove(path)
        return None
    items = {k: v for k, v in d.items() if not k.startswith("person:")}
    book = assemble(draft, items, list(d))
    book["org"] = dict(book["org"], slug=f"{slug}--preview")
    book["people"] = []
    for inv in book["invoices"]:
        inv["number"] = f"{inv['number']} (preview)"
    write_json(os.path.join(PREVIEW, f"{slug}--preview.json"), book)
    return book

# ---------------------------------------------------------------- commands

def cmd_status(a):
    _, _, d, l, new, changed, removed = diff(a.org)
    print(f"{a.org}: {len(new)} new · {len(changed)} changed · {len(removed)} removed in draft (live has {len(l)} items)")
    for tag, keys, src in (("NEW", new, d), ("CHANGED", changed, d), ("REMOVED", removed, l)):
        for k in keys:
            print(f"  {tag:8} {k:48} {src[k][0]}")


def cmd_lint(a):
    probs = lint(a.org)
    if not probs:
        print(f"{a.org}: lint clean")
        return 0
    for k, ps in probs.items():
        for p in ps:
            print(f"  {k}: {p}")
    return 1


def cmd_preview(a):
    b = write_preview(a.org)
    print("preview written" if b else "nothing pending: no preview")


def cmd_ticket(a):
    _, _, d, l, new, changed, removed = diff(a.org)
    name = (d.get("org") or l.get("org"))[1].get("short_name") or (d.get("org") or l.get("org"))[1]["name"]
    pending = new + changed
    if not pending:
        print(f"{name}: nothing waiting to publish.")
        return
    labels = [("New: " if k in new else "Changed: ") + d[k][0] for k in pending]
    print(f"{name}: {len(pending)} thing{'s' if len(pending) != 1 else ''} ready for their site. Publish? (a) Publish (b) Hold")
    for x in labels:
        print(f"  - {x}")


def cmd_approve(a):
    _, _, d, l, new, changed, removed = diff(a.org)
    keys = [k.strip() for k in a.items.split(",")] if a.items else new + changed
    unknown = [k for k in keys if k not in d]
    if unknown:
        raise SystemExit(f"not in the draft: {unknown}")
    probs = lint(a.org, keys)
    if probs:
        for k, ps in probs.items():
            for p in ps:
                print(f"  {k}: {p}", file=sys.stderr)
        raise SystemExit("lint failed: nothing published")
    publish(a.org, keys, a.by, a.ticket)
    print(f"{a.org}: published {len(keys)} item(s); live within 5 minutes")


def cmd_remove(a):
    keys = [k.strip() for k in a.items.split(",")]
    publish(a.org, [], a.by, a.ticket or "removal", removing=keys)
    print(f"{a.org}: removed {len(keys)} item(s) from the live site")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    for name in ("status", "lint", "preview", "ticket"):
        s = sub.add_parser(name)
        s.add_argument("org")
    s = sub.add_parser("approve")
    s.add_argument("org")
    s.add_argument("--by", required=True)
    s.add_argument("--ticket", required=True)
    s.add_argument("--items")
    s = sub.add_parser("remove")
    s.add_argument("org")
    s.add_argument("--items", required=True)
    s.add_argument("--by", required=True)
    s.add_argument("--ticket")
    a = ap.parse_args()
    rc = {"status": cmd_status, "lint": cmd_lint, "preview": cmd_preview, "ticket": cmd_ticket,
          "approve": cmd_approve, "remove": cmd_remove}[a.cmd](a)
    sys.exit(rc or 0)


if __name__ == "__main__":
    main()
