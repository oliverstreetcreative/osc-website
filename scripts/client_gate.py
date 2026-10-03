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
  client_gate.py auto    <org>            publish, WITHOUT a ticket, lint-clean changes of the kinds that never
                                          need Sam (SPEC §11 kinds v2); everything else stays waiting
  client_gate.py undo    <org> --at <log time> --by <who>
                                          put back what one auto-publish changed (if nothing changed since)
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

LEDGER = os.path.join(SITE, "ledger", "approvals")  # one JSON per client approval, written by the portal

STAGES = ("rough", "fine", "for_approval", "final")
STAGE_WORDS = {"rough": "rough cut", "fine": "fine cut", "for_approval": "for approval", "final": "final"}
# A version's link must be a Review share pinned to it (or a legacy Frame.io client link).
REVIEW_SHARE = re.compile(r"^https://review\.oliverstreetcreative\.com/share/[A-Za-z0-9_-]{8,}$")
LEGACY_FRAMEIO = re.compile(r"^https://f\.io/[A-Za-z0-9_-]+$")
UUIDISH = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$", re.I)

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
        for f in p["films"]:
            # Each version is its own fact (10/3 design review): an office-only version
            # never rides out with its film.
            f["versions"] = [v for v in f.get("versions", []) if keep(v)]
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
            own_f = {k: v for k, v in f.items() if k != "versions"}
            out[f"film:{p['key']}/{f['key']}"] = (f"Film: {f['title']}" + (f" ({f['version']})" if f.get("version") else ""), own_f)
            for v in f.get("versions", []):
                stage = STAGE_WORDS.get(v.get("stage"), v.get("stage") or "")
                out[f"version:{p['key']}/{f['key']}/{v['n']}"] = (
                    f"Version {v['n']} of {f['title']}" + (f" ({v.get('label') or stage})" if (v.get('label') or stage) else ""),
                    v,
                )
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
    projects, films = {}, {}
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
        elif kind == "film":
            pkey, fkey = rest.split("/")[0], rest.split("/")[1]
            if pkey in projects:  # a film only shows under a published project
                content["versions"] = []
                films[(pkey, fkey)] = content
                projects[pkey]["films"].append(content)
        elif kind == "version":
            pkey, fkey = rest.split("/")[0], rest.split("/")[1]
            if (pkey, fkey) in films:  # a version only shows under a published film
                films[(pkey, fkey)]["versions"].append(content)
        elif kind == "shoot":
            pkey = rest.split("/")[0]
            if pkey in projects:  # a shoot only shows under a published project
                projects[pkey]["shoots"].append(content)
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
# Kinds v2 (design review 10/3 08:40): words about money never publish WITHOUT Sam. Only the automatic path checks
# them (they'd be false alarms in the general lint: a client's own "Scope and budget" document is fine to show,
# and the general lint blocks Sam's approve outright).
MONEY_WORDS_FOR_AUTO = re.compile(r"\b(budget|pay|paid|invoice|cost|price|fee)\b|\$\s?\d", re.I)
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
            if k in ("path", "url", "watch_url", "review_url", "pay_url", "logo", "poster", "file", "email", "key", "slug",
                     "project_key", "share_url", "asset_id", "version_id", "master_sha256", "approvers"):
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
            if k in ("url", "watch_url", "review_url", "pay_url", "share_url") and isinstance(v, str):
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


def lint_item(key, content, org, items=None):
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
    if key.startswith("film:"):
        problems += film_problems(content, items or {})
    if key.startswith("version:"):
        problems += version_problems(key, content, items or {})
    return sorted(set(problems))


def film_problems(film, items):
    """Who may approve a film is said by the book (gated), never inferred from a role."""
    out = []
    people = {k.split(":", 1)[1] for k in items if k.startswith("person:")}
    for e in film.get("approvers", []) or []:
        if e.lower() not in people:
            out.append(f"approver {e} isn't one of this client's people in the book")
    if film.get("approval") not in (None, "any", "all"):
        out.append('approval must be "any" or "all"')
    return out


def version_problems(key, v, items):
    out = []
    n = v.get("n")
    if not isinstance(n, int) or n < 1 or key.rsplit("/", 1)[-1] != str(n):
        out.append("version number n must be a whole number matching its key")
    if v.get("stage") not in STAGES:
        out.append(f"stage must be one of {', '.join(STAGES)}")
    if v.get("posted_on") and not re.match(r"^\d{4}-\d{2}-\d{2}$", str(v["posted_on"])):
        out.append("posted_on must be YYYY-MM-DD")
    review = v.get("review") or {}
    url = review.get("share_url", "")
    if REVIEW_SHARE.match(url or ""):
        # A Review link must be pinned to THIS version (10/3 design review); the ids prove which picture it is.
        if not UUIDISH.match(str(review.get("asset_id", ""))) or not UUIDISH.match(str(review.get("version_id", ""))):
            out.append("a Review link needs the asset_id and version_id it is pinned to")
        if not isinstance(review.get("version_number"), int):
            out.append("a Review link needs Review's version_number")
    elif LEGACY_FRAMEIO.match(url or ""):
        if v.get("stage") == "for_approval":
            out.append("approval needs a version-pinned Review link, not a Frame.io link")
    elif url:
        out.append(f"not a client Review/Frame.io share link: {url}")
    else:
        out.append("no review.share_url")
    if v.get("stage") == "for_approval":
        film_key = "film:" + key.split(":", 1)[1].rsplit("/", 1)[0]
        film = items.get(film_key, (None, {}))[1] or {}
        if not film.get("approvers"):
            out.append("a version for approval needs the film's approvers list")
    return out


def lint(slug, keys=None):
    draft, live, d, l, new, changed, removed = diff(slug)
    keys = keys or (new + changed)
    org = d.get("org", (None, None))[1]
    if org and not org.get("folder"):
        return {"org": ["the book's org needs a 'folder' (its /Clients/... folder) so files can be checked"]}
    return {k: probs for k in keys if k in d for probs in [lint_item(k, d[k][1], org, d)] if probs}

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


def approved_job_versions():
    """Job-version keys ("<job>/<film-key>/<n>") a client has approved, from the portal's ledger files."""
    out = set()
    if not os.path.isdir(LEDGER):
        return out
    for name in os.listdir(LEDGER):
        if name.endswith(".json") and not name.startswith((".", "_")):
            try:
                rec = load(os.path.join(LEDGER, name)) or {}
            except Exception:
                continue
            if rec.get("job") and rec.get("film") and rec.get("n") is not None and not rec.get("withdrawn"):
                out.add(f"{rec['job']}/{rec['film']}/{rec['n']}")
    return out


def protected_items(items):
    """Version item keys in `items` that a client has approved: they may not change or disappear."""
    approved = approved_job_versions()
    out = {}
    for key, (_, content) in items.items():
        if not key.startswith("version:"):
            continue
        pkey, fkey, n = key.split(":", 1)[1].split("/")
        job = (items.get(f"project:{pkey}", (None, {}))[1] or {}).get("job_number")
        if job and f"{job}/{fkey}/{n}" in approved:
            out[key] = digest(content)
    return out


def publish(slug, keys, by, ticket, removing=(), extra=None):
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
    # An approved version is a record: it can't change, and nothing may make it disappear
    # (removing its film or project included). Withdrawing an approval is Sam's explicit act.
    after = flatten(book)
    broken = [k for k, h in protected_items(l).items() if k not in after or digest(after[k][1]) != h]
    if broken:
        raise SystemExit("refused: these versions were approved by the client and can't change or disappear: "
                         + ", ".join(broken))
    write_json(os.path.join(PUBLISHED, f"{slug}.json"), book)
    log(slug, {"by": by, "ticket": ticket, "published": list(keys), "removed": list(removing), **(extra or {})})
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

# ---------------------------------------------------------------- kinds, not items (SPEC §11 v2)

# Sam's tap is for what's NEW to a client. A lint-clean CHANGE to these fields of an already-published item
# publishes without a ticket. Dates wait until they come from the canonical calendar event; a film's `ask` may
# move to "notes" or "none" on its own, but `ask: ok` puts an Approve button in front of the client: Sam taps.
AUTO_FIELDS = {"project": {"status_line", "next_step", "summary"}, "film": {"ask"}}
AUTO_FILM_ASK = {"none", "notes"}


def auto_ok(key, before, after):
    """True when `before` -> `after` changes only fields that may publish without Sam."""
    kind = key.split(":", 1)[0]
    allowed = AUTO_FIELDS.get(kind)
    if not allowed:
        return False
    changed = {k for k in set(before) | set(after) if before.get(k) != after.get(k)}
    if not changed or not changed <= allowed:
        return False
    if "ask" in changed and after.get("ask") not in AUTO_FILM_ASK:
        return False
    return True


def cmd_auto(a):
    _, _, d, l, new, changed, removed = diff(a.org)
    candidates = [k for k in changed if auto_ok(k, l[k][1], d[k][1])]
    held = lint(a.org, candidates) if candidates else {}
    for k in candidates:
        money = next((m.group(0) for s in strings(d[k][1]) for m in [MONEY_WORDS_FOR_AUTO.search(s)] if m), None)
        if money and k not in held:
            held[k] = [f'mentions money ("{money}"): needs Sam\'s tap']
    clean = [k for k in candidates if k not in held]
    if clean:
        extra = {"previous": {k: l[k][1] for k in clean}, "after_digest": {k: digest(d[k][1]) for k in clean}}
        publish(a.org, clean, "auto: lint clean", "auto", extra=extra)
    for k in clean:
        print(f"  AUTO     {k:48} {d[k][0]}")
    for k, ps in held.items():
        print(f"  HELD     {k:48} {'; '.join(ps)}")
    waiting = [k for k in new + changed if k not in clean]
    print(f"{a.org}: {len(clean)} published automatically · {len(waiting)} waiting for Sam's tap")
    return 0


def read_log(slug):
    path = os.path.join(LOG, f"{slug}.jsonl")
    if not os.path.exists(path):
        return []
    with open(path, encoding="utf-8") as f:
        return [json.loads(line) for line in f if line.strip()]


def cmd_undo(a):
    entry = next((e for e in read_log(a.org) if e.get("at") == a.at and e.get("ticket") == "auto"), None)
    if not entry or not entry.get("previous"):
        raise SystemExit(f"no automatic publish at {a.at} in {a.org}'s log")
    live = load(os.path.join(PUBLISHED, f"{a.org}.json"))
    l = flatten(live)
    items = dict(l)
    put_back, moved_on = [], []
    for k, prev in entry["previous"].items():
        if k in l and digest(l[k][1]) == entry["after_digest"].get(k):
            items[k] = (l[k][0], prev)
            put_back.append(k)
        else:
            moved_on.append(k)  # changed again (or removed) since: undoing would clobber newer content
    if put_back:
        write_json(os.path.join(PUBLISHED, f"{a.org}.json"), assemble(live, items, list(l)))
        log(a.org, {"by": a.by, "ticket": "undo", "undid": a.at, "published": put_back, "removed": []})
        write_preview(a.org)
    note = f"; left {len(moved_on)} that changed since: {', '.join(moved_on)}" if moved_on else ""
    print(f"{a.org}: put back {len(put_back)} item(s){note}")
    return 0

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
    s = sub.add_parser("auto")
    s.add_argument("org")
    s = sub.add_parser("undo")
    s.add_argument("org")
    s.add_argument("--at", required=True)
    s.add_argument("--by", required=True)
    a = ap.parse_args()
    rc = {"status": cmd_status, "lint": cmd_lint, "preview": cmd_preview, "ticket": cmd_ticket,
          "approve": cmd_approve, "remove": cmd_remove, "auto": cmd_auto, "undo": cmd_undo}[a.cmd](a)
    sys.exit(rc or 0)


if __name__ == "__main__":
    main()
