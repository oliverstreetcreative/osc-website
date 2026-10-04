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
  client_gate.py clear-contact --person "<name>" --value "<phone or email>" --by Sam --ticket <id> [--org <slug>]
                                          Sam clears one contact detail that isn't OSC's, for THAT person's team card
                                          (and only that client, with --org); the list is gate-owned
  client_gate.py withdraw-contact --value "<phone or email>" --by Sam
                                          take a clearance back; lists the live books still showing the value
Item keys: org · person:<email> · project:<key> · film:<project>/<film> · shoot:<project>/<shoot>
           · invoice:<number> · document:<key>
           · library:<key> · clip:<library>/<clip key>   (footage packages, SPEC §23 v2: Stacks writes
             library/<org>/<key>.json; approve freezes published/library/<org>/<key>.json; pending ones show to staff
             in preview/library/<org>--preview/; removing a clip leaves a tombstone; at most 300 clips per ticket;
             every clip must be Sam's own standing favorite in Stacks and a signed one-track Mux asset)
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
CLEARED = os.path.join(SITE, "cleared-contacts.json")  # contact details Sam cleared for client pages (this tool writes)

STAGES = ("rough", "fine", "for_approval", "final")
STAGE_WORDS = {"rough": "rough cut", "fine": "fine cut", "for_approval": "for approval", "final": "final"}
# A version's link must be a Review share pinned to it (or a legacy Frame.io client link).
REVIEW_SHARE = re.compile(r"^https://review\.oliverstreetcreative\.com/share/[A-Za-z0-9_-]{8,}$")
LEGACY_FRAMEIO = re.compile(r"^https://f\.io/[A-Za-z0-9_-]+$")
UUIDISH = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$", re.I)

# Files every client may receive (OSC vendor paperwork).
SHARED_FILES = {"/_admin/Corporate Docs/W9 Oliver Street Creative_2026.pdf"}
# Stills pulled from delivered films. NOT the rest of client-site/: books, published copies, the ledger and staff.json
# live there (§23 design review 10/3: the old "/_admin/client-site/" prefix let a book point at another client's data).
SHARED_PREFIXES = ("/_admin/client-site/posters/",)


def plain_path(p):
    """A root-relative Dropbox path with no tricks: absolute, no '..' or '.' or empty segments, no backslashes. Without
    this, "/Clients/Acme/../Other/x.pdf" passes a startswith() containment check."""
    if not isinstance(p, str) or not p.startswith("/") or "\\" in p or "\x00" in p:
        return False
    return all(s not in ("", ".", "..") for s in p.split("/")[1:])


# ---------------------------------------------------------------- footage packages (SPEC §23 v2)
# Stacks writes one package per library into library/<org>/<key>.json (temp name + rename). Each package is a set of
# VIRTUAL items beside the book's: library:<key> (its title etc.) and clip:<key>/<clip key>. Same status, lint,
# ticket, approve, remove, log and preview as book items; never auto-published. Approve writes a frozen snapshot to
# published/library/<org>/<key>.json, the only place the site reads footage from.
LIBRARY_DRAFTS = os.path.join(SITE, "library")
LIBRARY_LIVE = os.path.join(PUBLISHED, "library")
LIBRARY_PREVIEW = os.path.join(PREVIEW, "library")
LIBRARY_FORMAT = "osc-library/2"
LIB_FIELDS = {"format", "org", "project", "job", "key", "title", "description", "made_by", "made_at"}
CLIP_FIELDS = {"key", "sam_event", "title", "taken_on", "fps", "mux_playback_id", "mux_asset_id", "duration_s", "thumb_s",
               "aspect"}
CLIP_REQUIRED = {"key", "sam_event", "title", "fps", "mux_playback_id", "mux_asset_id", "duration_s"}
CLIP_KEY = re.compile(r"^([0-9a-f]{16}-\d+)@(\d+)-(\d+)$")  # <stacks clip id = xxh64-size>@<in frame>-<out frame>
STACKS_EVENT_ID = re.compile(r"^[0-9a-f]{12}-[0-9a-f]{8}$")
MUX_ID = re.compile(r"^[A-Za-z0-9]{10,80}$")
MAX_CLIPS = 2000
DURATION_SLACK = 0.15  # seconds: a few frames, so no more than that sits outside Sam's range
# Test-only overrides are honoured only in a sandbox (DROPBOX_LOCAL_ROOT set), never on the real Dropbox.
SANDBOX = bool(os.environ.get("DROPBOX_LOCAL_ROOT"))
MAX_CLIPS_PER_TICKET = int(os.environ.get("GATE_MAX_CLIPS_PER_TICKET", "300")) if SANDBOX else 300
# Where Stacks' own rules and marks live (read-only here; the website never reads them). The live Dropbox root is
# found the way Stacks finds it (engine/stacks/paths.py DROPBOX_ROOTS: the one that holds Matters/), so the gate
# reads the same copy of the marks Stacks writes.
STACKS_ENGINE = os.environ.get("STACKS_ENGINE") or os.path.expanduser("~/code/stacks/engine")
STACKS_EVENTS = [os.environ["STACKS_EVENTS_DIR"]] if os.environ.get("STACKS_EVENTS_DIR") else [
    os.path.join(r, "Vault Archive Records", "events")
    for r in ("/Volumes/dropbox-sam", os.path.expanduser("~/Dropbox (Personal)"), os.path.expanduser("~/Dropbox"),
              os.path.expanduser("~/Library/CloudStorage/Dropbox"))
    if os.path.isdir(os.path.join(r, "Matters"))]
TOMBSTONE_NOTE = "previously removed by Sam: publish only by naming it in --items"

# ---------------------------------------------------------------- proposals (SPEC §24 v2)
# A proposal the client may accept is frozen: on publish its PDF is copied (add-only) to frozen/<sha256>.pdf and the
# published document carries frozen_sha256; the site serves ONLY that copy, hash-checked. An accepted proposal (the
# portal's ledger/acceptances/) can't change or disappear. No `ask: accept` publishes until Majordomo reads that
# ledger and tickets Sam (it writes ledger/acceptances/_reader.json), so a client's yes never lands unheard.
FROZEN = os.path.join(SITE, "frozen")
ACCEPTANCES = os.path.join(SITE, "ledger", "acceptances")
ACCEPT_READER = os.path.join(ACCEPTANCES, "_reader.json")
DOC_ASKS = ("none", "accept")


def file_sha256(path):
    full = os.path.join(ROOT, path.lstrip("/"))
    if not os.path.isfile(full):
        return None
    h = hashlib.sha256()
    with open(full, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def accepted_documents(slug):
    """Document keys of `slug` a client has accepted (not withdrawn), from the portal's ledger files."""
    out = set()
    if not os.path.isdir(ACCEPTANCES):
        return out
    for name in os.listdir(ACCEPTANCES):
        if name.endswith(".json") and not name.startswith((".", "_")):
            try:
                rec = load(os.path.join(ACCEPTANCES, name)) or {}
            except Exception:
                continue
            if rec.get("org") == slug and rec.get("document") and not rec.get("withdrawn"):
                out.add(rec["document"])
    return out


def read_packages(base, slug):
    """{file key: package} for base/<slug>/*.json, and the names that aren't ready (unreadable, 0-byte online-only,
    mid-write). Dotfiles, '_' names and temp names (not ending .json) are never packages."""
    folder = os.path.join(base, slug)
    out, not_ready = {}, []
    if not os.path.isdir(folder):
        return out, not_ready
    for name in sorted(os.listdir(folder)):
        if name.startswith((".", "_")) or not name.endswith(".json"):
            continue
        path = os.path.join(folder, name)
        try:
            pkg = load(path) if os.path.getsize(path) > 0 else None
        except Exception:
            pkg = None
        if isinstance(pkg, dict):
            out[name[:-5]] = pkg
        else:
            not_ready.append(name[:-5])
    return out, not_ready


def flatten_libraries(pkgs):
    out = {}
    for fkey, pkg in pkgs.items():
        clips = pkg.get("clips") if isinstance(pkg.get("clips"), list) else []
        # The count lives in the label only: a clip's own add or removal is its own item, never a library change.
        meta = {k: v for k, v in pkg.items() if k != "clips"}
        out[f"library:{fkey}"] = (f"Footage: {pkg.get('title') or fkey} ({len(clips)} clip{'s' if len(clips) != 1 else ''})", meta)
        for c in clips:
            ck = c.get("key") if isinstance(c, dict) else None
            out[f"clip:{fkey}/{ck}"] = (f"Clip: {(c or {}).get('title') or ck} ({pkg.get('title') or fkey})", c)
    return out


def assemble_libraries(items, order):
    """Items -> {library key: package} in order; a clip only shows under a published library."""
    libs = {}
    for key in order:
        if key not in items:
            continue
        kind, _, rest = key.partition(":")
        if kind == "library":
            meta = copy.deepcopy(items[key][1])
            meta["clips"] = []
            libs[rest] = meta
        elif kind == "clip":
            lib = rest.split("/", 1)[0]
            if lib in libs:
                libs[lib]["clips"].append(copy.deepcopy(items[key][1]))
    return libs

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
    # Footage packages (SPEC §23 v2): virtual items beside the book's, only once the client details exist.
    if draft:
        drafts, not_ready = read_packages(LIBRARY_DRAFTS, slug)
        d.update(flatten_libraries(drafts))
    else:
        not_ready = []
    l.update(flatten_libraries(read_packages(LIBRARY_LIVE, slug)[0]))
    # Proposals are bound to their bytes (SPEC §24 v2): the draft's file hash is part of the item, so a PDF
    # re-rendered at the same path shows up as CHANGED and needs Sam's tap.
    for k, (_, content) in d.items():
        if k.startswith("document:") and content.get("kind") == "proposal" and content.get("path"):
            sha = file_sha256(content["path"]) if plain_path(content["path"]) else None
            if sha:
                content["frozen_sha256"] = sha
    # A package that's mid-write or online-only is NOT READY: it neither changes nor disappears.
    for name in not_ready:
        for k, v in l.items():
            if k == f"library:{name}" or k.startswith(f"clip:{name}/"):
                d.setdefault(k, v)
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
OSC_E164 = "+18595121419"
PHONE = re.compile(r"\(?\b\d{3}\)?[-. ]\d{3}[-. ]\d{4}\b")
# Any North American number, however it's written: "513-555-1234", "(513) 555 1234", "+15135551234", "5135551234"
# (SPEC §21 v2: the old pattern missed the +1 form a tel: link needs).
_SEP = r"[\s.\-\u2013\u2014/\u00a0]{0,3}"
PHONE_ANY = re.compile(r"(?<!\d)(?:\+?1" + _SEP + r")?\(?[2-9]\d{2}\)?" + _SEP + r"[2-9]\d{2}" + _SEP + r"\d{4}(?!\d)")
EMAIL_ONE = re.compile(r"^[\w.+-]+@([\w-]+\.)+[\w-]{2,}$")
KEY_RE = re.compile(r"^[a-z0-9][a-z0-9-]*$")


def e164(text):
    """'+1' + ten digits for a real North American number (area code and exchange start 2-9), else None."""
    digits = re.sub(r"\D", "", text)
    if len(digits) == 11 and digits.startswith("1"):
        digits = digits[1:]
    return "+1" + digits if re.fullmatch(r"[2-9]\d{2}[2-9]\d{6}", digits) else None


def _norm_person(name):
    return re.sub(r"\s+", " ", (name or "").strip().lower())


def clearances():
    """Live clearances: [{value, person, org?}] (phones +1..., emails lower-case, names normalised)."""
    data = load(CLEARED) or {}
    return [c for c in data.get("cleared", []) if c.get("value") and not c.get("withdrawn")]


def cleared_contacts():
    """Values cleared for ANY person (free text has no person to match; team cards check person too)."""
    return {c["value"] for c in clearances()}


def cleared_for(value, person, org_slug):
    """True when Sam cleared this value for this person (and, if he scoped it, for this client)."""
    who = _norm_person(person)
    return any(c["value"] == value and _norm_person(c.get("person")) == who and c.get("org") in (None, org_slug)
               for c in clearances())
EMAIL = re.compile(r"[\w.+-]+@([\w-]+\.)+[\w-]+")
BAD_FILENAME = re.compile(r"prelim|internal|\bbid\b|_bid|bid_|packet|editor-brief|action-document|budget|crew|rates?\b|deal-memo|transcript", re.I)
TEAM_FRAMEIO = re.compile(r"app\.frame\.io/(projects|player)/", re.I)


SKIP_KEYS = ("path", "url", "watch_url", "review_url", "pay_url", "logo", "poster", "file", "email", "key", "slug",
             "project_key", "share_url", "asset_id", "version_id", "master_sha256", "approvers", "review_asset_id",
             "version_review_id", "acceptors", "good_until", "frozen_sha256")
# Footage packages only (library:/clip: items): ids, slugs and stamps, never words a client reads. Kept out of the
# book's list so a future book field named "job" or "format" is still linted.
FOOTAGE_SKIP_KEYS = SKIP_KEYS + ("sam_event", "mux_playback_id", "mux_asset_id", "format", "made_at", "made_by",
                                 "taken_on", "job", "org", "project", "aspect")


def strings(obj, skip=SKIP_KEYS):
    if isinstance(obj, str):
        yield obj
    elif isinstance(obj, dict):
        for k, v in obj.items():
            if k in skip:
                continue
            yield from strings(v, skip)
    elif isinstance(obj, list):
        for v in obj:
            yield from strings(v, skip)


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
    cleared = cleared_contacts()
    for m in PHONE_ANY.finditer(text):
        n = e164(m.group(0))
        if n and n != OSC_E164 and n not in cleared:
            out.append(f"a phone number that isn't OSC's: {m.group(0)}")
    return out


def team_problems(project, org_slug=None):
    """A project's team card (SPEC §21 v2): contact details are OSC's or cleared by Sam FOR THAT PERSON (and client);
    never a personal address. Formats are checked here too: the site drops a malformed field rather than failing the
    book, so the gate is where Sam hears about it. Needed because the general text lint skips every key named "email"."""
    out = []
    ids = set()
    for member in project.get("team") or []:
        who = member.get("name", "someone")
        mid = member.get("id")
        if mid is not None and (not isinstance(mid, str) or not KEY_RE.match(mid)):
            out.append(f"{who}'s id must be lowercase-kebab (like sam-patton): {mid!r}")
        key = mid if isinstance(mid, str) and mid else re.sub(r"[^a-z0-9]+", "-", who.lower()).strip("-")
        if key in ids:
            out.append(f"two people on this team share the id {key!r}; give one an id")
        ids.add(key)
        if "mobile" in member and not isinstance(member["mobile"], bool):
            out.append(f"{who}'s mobile must be true or false")
        raw_email = member.get("email")
        email = (raw_email or "").strip().lower() if isinstance(raw_email, str) else ""
        if raw_email is not None and not EMAIL_ONE.match(email):
            out.append(f"{who}'s email isn't an email address: {raw_email!r}")
        elif email and not email.endswith("@oliverstreetcreative.com") and not cleared_for(email, who, org_slug):
            out.append(f"{who}'s email isn't an OSC address and isn't cleared for {who}: {email}")
        phone = member.get("phone")
        if phone:
            n = e164(phone)
            if not n:
                out.append(f"{who}'s phone isn't a number we can dial: {phone}")
            elif n != OSC_E164 and not cleared_for(n, who, org_slug):
                out.append(f"{who}'s phone isn't OSC's and isn't cleared for {who}: {phone}")
        for k in ("address", "home", "location"):
            if member.get(k):
                out.append(f"{who}: no personal addresses on a team card (the map pin is the shoot's address)")
    return out


def lint_item(key, content, org, items=None):
    problems = []
    folder = (org or {}).get("folder")
    domains = {x.lower() for x in (org or {}).get("domains", [])}
    skip = FOOTAGE_SKIP_KEYS if key.startswith(("library:", "clip:")) else SKIP_KEYS
    for s in strings(content, skip):
        problems += text_problems(s, domains)
    for p in paths(content):
        name = p.rsplit("/", 1)[-1]
        if not plain_path(p):
            problems.append(f"file path must be a plain root-relative path (no '..', '.', '//' or backslashes): {p}")
            continue
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
    if key.startswith("project:"):
        problems += team_problems(content, (org or {}).get("slug"))
    if key.startswith("film:"):
        problems += film_problems(content, items or {}, key)
    if key.startswith("version:"):
        problems += version_problems(key, content, items or {})
    if key.startswith("document:"):
        problems += document_problems(key, content, org or {}, items or {})
    if key.startswith("library:"):
        problems += library_problems(key, content, org or {}, items or {})
    if key.startswith("clip:"):
        problems += clip_problems(key, content, items or {})
    return sorted(set(problems))


def document_problems(key, doc, org, items):
    """SPEC §24 v2: `ask: accept` puts an Accept button in front of the named acceptors, so the proposal must be
    checkable bytes whose numbers match the book, and Sam must be able to hear the yes."""
    out = []
    ask = doc.get("ask", "none")
    if ask not in DOC_ASKS:
        return [f"ask must be one of {', '.join(DOC_ASKS)}"]
    if ask != "accept":
        return out
    if doc.get("kind") != "proposal":
        return ["only a proposal can ask for an Accept"]
    path = doc.get("path") or ""
    if doc.get("url") or not path.lower().endswith(".pdf"):
        return ["asking for an Accept needs the proposal as a .pdf path (a link has no bytes to bind the yes to)"]
    text = pdf_text(path)
    if not text or not text.strip():
        out.append("can't read the proposal's text (pdftotext missing or an image-only PDF): it must be checkable")
    flat = re.sub(r"\s+", " ", text or "")
    total = doc.get("total")
    if not isinstance(total, (int, float)) or total <= 0:
        out.append("asking for an Accept needs the proposal's total (a number)")
    elif text:
        shown = f"${total:,.0f}" if float(total).is_integer() else f"${total:,.2f}"
        if shown not in flat:
            out.append(f"the total {shown} isn't in the PDF: the book and the proposal must say the same number")
    good = str(doc.get("good_until") or "")
    try:
        good_day = dt.date.fromisoformat(good)
    except ValueError:
        good_day = None
        out.append("asking for an Accept needs good_until (YYYY-MM-DD)")
    if good_day:
        import zoneinfo
        if good_day < dt.datetime.now(zoneinfo.ZoneInfo("America/New_York")).date():
            out.append(f"good_until {good} has passed")
        long = f"{good_day:%B} {good_day.day}, {good_day.year}"
        if text and long not in flat:
            out.append(f"“{long}” isn't in the PDF: print the date itself (not “30 days from the date above”)")
    if text and re.search(r"\bmarkup\b", text, re.I):
        out.append('inside the PDF: "markup" (an internal pricing word)')
    if text and re.search(r"\bcost\b.{0,60}\bcharge\b", text, re.I | re.S):
        out.append("inside the PDF: it looks like the internal cost/charge sheet")
    people = {k.split(":", 1)[1] for k in items if k.startswith("person:")}
    acceptors = doc.get("acceptors") or []
    if not acceptors:
        out.append("asking for an Accept needs the acceptors list (the people who may say yes)")
    for e in acceptors:
        if str(e).lower() not in people:
            out.append(f"acceptor {e} isn't one of this client's people in the book")
        elif (items[f"person:{str(e).lower()}"][1] or {}).get("role", "VIEWER") not in ("OWNER", "APPROVER", "BILLING"):
            out.append(f"acceptor {e} is a VIEWER in the book, and VIEWERs see no money: give them a role or drop them")
    project = (items.get(f"project:{doc.get('project_key')}", (None, None))[1]) if doc.get("project_key") else None
    if not project or not project.get("job_number"):
        out.append("asking for an Accept needs a project with a job_number (the acceptance is recorded by job)")
    same = [k for k, (_, c) in items.items() if k.startswith("document:") and c.get("kind") == "proposal"
            and c.get("ask") == "accept" and c.get("project_key") == doc.get("project_key")]
    if len(same) > 1:
        out.append(f"one open Accept per project (this one has {len(same)}: {', '.join(same)})")
    if not os.path.exists(ACCEPT_READER):
        out.append("not yet: nothing tells Sam when a client accepts (Majordomo writes ledger/acceptances/_reader.json "
                   "once it reads that folder)")
    return out


def library_problems(key, meta, org, items):
    """A footage package's own fields (SPEC §23 v2). Closed schema: anything else fails, so AI marks, comments,
    notes-track names, rights notes or paths can't ride along."""
    fkey = key.split(":", 1)[1]
    out = [f"unexpected field {k!r} (the package format is closed)" for k in sorted(set(meta) - LIB_FIELDS)]
    if meta.get("format") != LIBRARY_FORMAT:
        out.append(f"format must be {LIBRARY_FORMAT!r}")
    if meta.get("key") != fkey or not KEY_RE.match(str(meta.get("key", ""))):
        out.append(f"the package's key must be lowercase-kebab and equal its file name ({fkey}.json)")
    if meta.get("org") != org.get("slug"):
        out.append(f"the package names org {meta.get('org')!r}, but it sits in {org.get('slug')!r}'s folder")
    project = (items.get(f"project:{meta.get('project')}", (None, None))[1]) if meta.get("project") else None
    if not project:
        out.append(f"project {meta.get('project')!r} isn't one of this client's projects in the book")
    elif not project.get("job_number") or meta.get("job") != project.get("job_number"):
        out.append(f"job {meta.get('job')!r} must equal the project's job_number ({project.get('job_number')!r})")
    if not isinstance(meta.get("title"), str) or not meta["title"].strip() or len(meta["title"]) > 120:
        out.append("a title of 1–120 characters")
    # Optional fields are LEFT OUT, never null: the site's schema (lib/client/library-shape.ts) is the same.
    out += [f"{k} must be left out rather than null" for k in ("description", "made_by", "made_at") if k in meta and meta[k] is None]
    if meta.get("description") is not None and (not isinstance(meta["description"], str) or len(meta["description"]) > 600):
        out.append("description: text up to 600 characters")
    for k in ("made_by", "made_at"):
        if meta.get(k) is not None and not isinstance(meta[k], str):
            out.append(f"{k} must be text")
    n = sum(1 for k in items if k.startswith(f"clip:{fkey}/"))
    if not 1 <= n <= MAX_CLIPS:
        out.append(f"a library holds 1–{MAX_CLIPS} clips (this one: {n})")
    return out


def clip_problems(key, c, items):
    """One clip (SPEC §23 v2): its own signed Mux asset, rendered by Stacks from a range SAM favorited."""
    lib, _, ck = key.split(":", 1)[1].partition("/")
    if not isinstance(c, dict):
        return ["a clip must be an object"]
    out = [f"unexpected field {k!r} (the package format is closed)" for k in sorted(set(c) - CLIP_FIELDS)]
    out += [f"{k} must be left out rather than null" for k in sorted(set(c) & CLIP_FIELDS) if c[k] is None]
    if out:
        return out
    missing = sorted(CLIP_REQUIRED - set(c))
    if missing:
        return out + [f"missing {', '.join(missing)}"]
    m = CLIP_KEY.match(str(c["key"]))
    if not m or c["key"] != ck:
        return out + ["key must be <stacks clip id>@<in frame>-<out frame>"]
    clip_id, a, b = m.group(1), int(m.group(2)), int(m.group(3))
    if a >= b:
        out.append("the in frame must come before the out frame")
    fps = c["fps"]
    if not isinstance(fps, (int, float)) or not 1 <= fps <= 240:
        out.append("fps must be a number from 1 to 240")
        fps = None
    dur = c["duration_s"]
    if not isinstance(dur, (int, float)) or dur <= 0:
        out.append("duration_s must be a positive number")
    elif fps and abs(dur - (b - a + 1) / fps) > DURATION_SLACK:
        out.append(f"duration_s {dur} doesn't match the frames ({(b - a + 1) / fps:.2f}s at {fps} fps)")
    t = c.get("thumb_s")
    if t is not None and (not isinstance(t, (int, float)) or t < 0 or (isinstance(dur, (int, float)) and t > dur)):
        out.append("thumb_s must be a time inside the clip")
    if c.get("taken_on") is not None and not re.match(r"^\d{4}-\d{2}-\d{2}$", str(c["taken_on"])):
        out.append("taken_on must be YYYY-MM-DD")
    if c.get("aspect") is not None and not re.match(r"^\d{1,4}[:/]\d{1,4}$", str(c["aspect"])):
        out.append('aspect like "16:9"')
    if not isinstance(c["title"], str) or not c["title"].strip() or len(c["title"]) > 120:
        out.append("a title of 1–120 characters")
    if not MUX_ID.match(str(c["mux_playback_id"])) or not MUX_ID.match(str(c["mux_asset_id"])):
        out.append("Mux ids look wrong")
    if not STACKS_EVENT_ID.match(str(c["sam_event"])):
        out.append("sam_event must be a Stacks event id")
    if out:
        return out
    why = sam_favorite_problem(clip_id, c["sam_event"], a, b, fps)
    if why:
        out.append(why)
    job = (items.get(f"library:{lib}", (None, {}))[1] or {}).get("job")
    out += mux_problems(c, job, (b - a + 1) / fps)
    return out


_fold = None


def stacks_fold():
    """Stacks' own fold() (engine/stacks/ratings.py; stdlib only), so "Sam's favorite" means exactly what Stacks
    shows. Read-only use: the gate loads the events itself and never calls anything that writes."""
    global _fold
    if _fold is None:
        try:
            if STACKS_ENGINE not in sys.path:
                sys.path.insert(0, STACKS_ENGINE)
            from stacks.ratings import fold  # noqa: E402
            _fold = fold
        except Exception:
            _fold = False
    return _fold or None


def sam_favorite_problem(clip_id, sam_event, a, b, fps=None):
    """None when frames a..b sit inside a favorite SAM marked himself (event `sam_event`), still standing after every
    later mark, edit, unrate and retraction. AI, sam-on-set, client and unrated ranges never pass. The raw event must
    itself be Sam's favorite rate (Stacks lets an admin `edit` anyone's mark while keeping its author, so an edit by
    anyone else refuses the clip), and the fps the package rendered at must be Stacks' own for that range."""
    fold = stacks_fold()
    if not fold:
        return f"can't check it's Sam's pick: Stacks' engine isn't at {STACKS_ENGINE}"
    root = next((p for p in STACKS_EVENTS if os.path.isdir(p)), None)
    if not root:
        return "can't check it's Sam's pick: Stacks' marks (Vault Archive Records/events) aren't reachable"
    folder = os.path.join(root, clip_id[:2], clip_id)
    try:
        raw = [load(os.path.join(folder, n)) for n in sorted(os.listdir(folder))
               if n.endswith(".json") and not n.startswith((".", "_"))] if os.path.isdir(folder) else []
        evs = [e for e in raw if isinstance(e, dict) and e.get("clip") == clip_id]  # nothing filed under the wrong clip
        mine = next((e for e in evs if e.get("id") == sam_event), None)
        author = (mine or {}).get("author") or {}
        if not mine or mine.get("kind") != "rate" or mine.get("rating") != "favorite" or author.get("kind") != "sam":
            return "not Sam's pick: sam_event must be Sam's own favorite in Stacks"
        for e in evs:
            if e.get("kind") == "edit" and sam_event in (e.get("targets") or []) and (e.get("author") or {}).get("kind") != "sam":
                return "not Sam's pick as he marked it: someone else edited that favorite in Stacks"
        layer = fold(evs).get("layers", {}).get("sam", [])
    except Exception as e:
        return f"can't read Stacks' marks for this clip ({type(e).__name__})"
    seg = next((s for s in layer if s.get("rating") == "favorite" and s.get("event") == sam_event
                and s["in_frame"] <= a and s["out_frame"] >= b), None)
    if not seg:
        return "not Sam's pick: the range must sit inside a favorite Sam marked himself in Stacks, still standing"
    if fps is not None and isinstance(seg.get("fps"), (int, float)) and abs(seg["fps"] - fps) > 0.01:
        return f"fps {fps} isn't Stacks' {seg['fps']} for this range"
    return None


_mux_creds = None
_mux_seen = {}


def mux_credentials():
    global _mux_creds
    if _mux_creds is None:
        tid, sec = os.environ.get("MUX_TOKEN_ID", ""), os.environ.get("MUX_TOKEN_SECRET", "")
        if not (tid and sec):
            try:
                get = lambda s: subprocess.run(["security", "find-generic-password", "-s", s, "-a", "sam", "-w"],
                                               capture_output=True, text=True, timeout=10).stdout.strip()
                tid, sec = get("mux-token-id"), get("mux-token-secret")
            except Exception:
                tid = sec = ""
        _mux_creds = (tid, sec) if tid and sec else False
    return _mux_creds or None


def mux_asset(asset_id):
    """(asset, None) or (None, why). Read-only GET; GATE_MUX_FIXTURE (a JSON {asset id: asset}) stands in for tests."""
    fixture = os.environ.get("GATE_MUX_FIXTURE") if SANDBOX else None
    if fixture:
        a = (load(fixture) or {}).get(asset_id)
        return (a, None) if a else (None, "not found on Mux")
    if asset_id in _mux_seen:
        return _mux_seen[asset_id]
    creds = mux_credentials()
    if not creds:
        return None, "no Mux API credentials on this Mac (Keychain mux-token-id / mux-token-secret)"
    import base64
    import time
    import urllib.error
    import urllib.request
    auth = base64.b64encode(f"{creds[0]}:{creds[1]}".encode()).decode()
    req = urllib.request.Request(f"https://api.mux.com/video/v1/assets/{asset_id}", headers={"Authorization": f"Basic {auth}"})
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            res = ((json.load(r) or {}).get("data"), None)
    except urllib.error.HTTPError as e:
        res = (None, "not found on Mux" if e.code == 404 else f"Mux answered {e.code}")
    except Exception as e:
        res = (None, f"couldn't reach Mux ({type(e).__name__})")
    _mux_seen[asset_id] = res
    time.sleep(0.1)  # gentle on Mux's API when a package has hundreds of clips
    return res


def mux_problems(c, job, frames_s):
    """The clip's Mux asset is what the contract says: ready, SIGNED playback only, one audio track of at most two
    channels (the client mix: no isolated lavs, no notes tracks), no text tracks (captions or descriptions a player
    could switch on), no downloadable renditions (no downloads in v1), its length within a few frames of Sam's range,
    and passthrough <job>/<clip key>."""
    asset, why = mux_asset(c["mux_asset_id"])
    if not asset:
        return [f"can't check the clip on Mux: {why}"]
    out = []
    if asset.get("status") != "ready":
        out.append(f"the Mux asset isn't ready ({asset.get('status')})")
    pids = asset.get("playback_ids") or []
    policies = sorted({str(p.get("policy")) for p in pids})
    if policies != ["signed"]:
        out.append(f"the Mux asset must have signed playback only (it has: {', '.join(policies) or 'none'})")
    if c["mux_playback_id"] not in {p.get("id") for p in pids}:
        out.append("mux_playback_id isn't one of this asset's playback ids")
    tracks = asset.get("tracks") or []
    audio = [t for t in tracks if t.get("type") == "audio"]
    if len(audio) != 1 or not isinstance(audio[0].get("max_channels"), int) or audio[0]["max_channels"] > 2:
        out.append("the clip must carry exactly one audio track of at most 2 channels (the client mix)")
    if any(t.get("type") == "text" for t in tracks):
        out.append("the clip must carry no text tracks (captions or descriptions a player could switch on)")
    statics = asset.get("static_renditions")
    has_statics = isinstance(statics, dict) and (bool(statics.get("files")) or statics.get("status") not in (None, "disabled"))
    if asset.get("mp4_support") not in (None, "none") or has_statics:
        out.append("the clip must have no downloadable renditions (no downloads in v1)")
    dur = asset.get("duration")
    if not isinstance(dur, (int, float)) or abs(dur - frames_s) > DURATION_SLACK:
        out.append(f"Mux says the clip is {dur}s; Sam's range is {frames_s:.2f}s")
    want = f"{job}/{c['key']}"
    if asset.get("passthrough") != want:
        out.append(f"the Mux asset's passthrough must be {want!r}")
    return out


FILM_ASKS = ("none", "notes", "ok")


def film_problems(film, items, key=None):
    """Who may approve a film is said by the book (gated), never inferred from a role. SPEC §13 v4: a Review link
    carries its asset id (versions are read live from Review), and asking for an OK needs approvers, that link and
    the project's job number (the approvals ledger, and so the lock below, is keyed by it). Sam's version label
    names a Review version only when the book says which one (`version_review_id`), so a receipt never pairs
    Review's Version 3 with a label written for another cut."""
    out = []
    vr = film.get("version_review_id")
    if vr is not None and not UUIDISH.match(str(vr)):
        out.append("version_review_id must be the Review version's id (a uuid)")
    people = {k.split(":", 1)[1] for k in items if k.startswith("person:")}
    for e in film.get("approvers", []) or []:
        if e.lower() not in people:
            out.append(f"approver {e} isn't one of this client's people in the book")
    if film.get("approval") not in (None, "any", "all"):
        out.append('approval must be "any" or "all"')
    url = film.get("review_url") or ""
    if url and REVIEW_SHARE.match(url) and not UUIDISH.match(str(film.get("review_asset_id", ""))):
        out.append("a Review link needs its review_asset_id (the shared asset's id)")
    ask = film.get("ask")
    if ask is not None and ask not in FILM_ASKS:
        out.append(f'ask must be one of {", ".join(FILM_ASKS)}')
    if ask == "ok":
        if not film.get("approvers"):
            out.append('asking for an OK needs the film\'s approvers list')
        if not REVIEW_SHARE.match(url):
            out.append("asking for an OK needs the film's Review link (review_url)")
        pkey = key.split(":", 1)[1].split("/")[0] if key and ":" in key else None
        project = (items.get(f"project:{pkey}", (None, {}))[1] or {}) if pkey else {}
        if not project.get("job_number"):
            out.append("asking for an OK needs the project's job_number (approvals are recorded by job)")
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


def lint(slug, keys=None, snap=None):
    """Problems per pending item. `snap` is a diff() taken once by the caller, so what's linted is exactly what
    publish() then writes (a package re-exported mid-approve can't slip in unlinted)."""
    draft, live, d, l, new, changed, removed = snap or diff(slug)
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


def film_binding(content):
    """What a v4 approval points at (SPEC §13): the film's Review link and shared asset."""
    return digest({"review_url": content.get("review_url"), "review_asset_id": content.get("review_asset_id")})


def protected_items(items):
    """What client approvals lock in `items`, as {key: digest}; none of it may change or disappear.
    v3 version items: the whole item. v4 films (versions live in Review): the Review link and asset id, so an
    approval's receipt and the approve page keep pointing at the same picture; other film fields stay editable.
    Accepted proposals (SPEC §24 v2): the whole document; a revision after acceptance is a new key."""
    slug = (items.get("org", (None, {}))[1] or {}).get("slug")
    accepted = accepted_documents(slug) if slug else set()
    out_docs = {k: digest(c) for k, (_, c) in items.items() if k.startswith("document:") and k.split(":", 1)[1] in accepted}
    approved = approved_job_versions()
    films = {k.rsplit("/", 1)[0] for k in approved}
    out = {}
    for key, (_, content) in items.items():
        kind, _, rest = key.partition(":")
        if kind not in ("version", "film"):
            continue
        parts = rest.split("/")
        job = (items.get(f"project:{parts[0]}", (None, {}))[1] or {}).get("job_number")
        if not job:
            continue
        if kind == "version" and f"{job}/{parts[1]}/{parts[2]}" in approved:
            out[key] = digest(content)
        elif kind == "film" and f"{job}/{parts[1]}" in films:
            out[key] = film_binding(content)
    out.update(out_docs)
    return out


def still_protected(key, h, after):
    return key in after and (film_binding(after[key][1]) if key.startswith("film:") else digest(after[key][1])) == h


def publish(slug, keys, by, ticket, removing=(), extra=None, snap=None, tombstone=()):
    """Write the live book (and footage snapshots) from `snap` (default: a fresh diff). `tombstone` = the keys Sam
    pulled by hand: those clips (and a pulled library's clips) can only return when named in --items."""
    draft, live, d, l, *_ = snap or diff(slug)
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
    broken = [k for k, h in protected_items(l).items() if not still_protected(k, h, after)]
    if broken:
        raise SystemExit("refused: these were approved by the client and can't change or disappear (a film keeps the "
                         "Review link and asset it was approved on; new cuts go up as new versions of that asset, and "
                         "a different asset needs a new film): " + ", ".join(broken))
    freeze_proposals(slug, keys, d)
    write_json(os.path.join(PUBLISHED, f"{slug}.json"), book)
    write_libraries(slug, items, order, l, by, tombstone)
    log(slug, {"by": by, "ticket": ticket, "published": list(keys), "removed": list(removing), **(extra or {})})
    write_preview(slug)
    return book


def freeze_proposals(slug, keys, d):
    """Copy each proposal being published to frozen/<sha256>.pdf (add-only), from the bytes the snapshot hashed. If
    the file changed since (re-rendered mid-approve), refuse: Sam's tap was for the other bytes."""
    for k in keys:
        c = d[k][1] if k in d else {}
        sha = c.get("frozen_sha256") if k.startswith("document:") else None
        if not sha:
            continue
        dest = os.path.join(FROZEN, f"{sha}.pdf")
        if os.path.exists(dest):
            continue
        src = os.path.join(ROOT, c["path"].lstrip("/"))
        with open(src, "rb") as f:
            data = f.read()
        if hashlib.sha256(data).hexdigest() != sha:
            raise SystemExit(f"refused: {k}'s PDF changed since it was checked; make a new ticket")
        os.makedirs(FROZEN, exist_ok=True)
        tmp = dest + ".tmp"
        with open(tmp, "wb") as f:
            f.write(data)
        os.replace(tmp, dest)


def write_libraries(slug, items, order, before, by, tombstone=()):
    """Footage (SPEC §23 v2): every published library is a frozen snapshot file the site syncs. A library that left
    moves to _removed/ (kept, never deleted). What Sam pulled by hand (`tombstone`: clips, or a library and all its
    live clips) is tombstoned, so it can only come back by being named in --items, on a ticket that says so."""
    folder = os.path.join(LIBRARY_LIVE, slug)
    libs = assemble_libraries(items, order)
    for key, pkg in libs.items():
        path = os.path.join(folder, f"{key}.json")
        if load(path) != pkg:
            write_json(path, pkg)
    stamp = dt.datetime.now().strftime("%Y%m%d-%H%M%S")
    for k in before:
        if k.startswith("library:") and k.split(":", 1)[1] not in libs:
            src = os.path.join(folder, k.split(":", 1)[1] + ".json")
            if os.path.exists(src):
                os.makedirs(os.path.join(folder, "_removed"), exist_ok=True)
                os.replace(src, os.path.join(folder, "_removed", f"{k.split(':', 1)[1]}.{stamp}.json"))
    pulled = set()
    for k in tombstone:
        if k.startswith("clip:"):
            pulled.add(k)
        elif k.startswith("library:"):
            lib = k.split(":", 1)[1]
            pulled.add(k)
            pulled.update(x for x in before if x.startswith(f"clip:{lib}/"))
    if pulled:
        path = os.path.join(folder, "_tombstones.json")
        stones = load(path) or {}
        for k in sorted(pulled):
            stones[k] = {"removed_at": dt.datetime.now().astimezone().isoformat(timespec="seconds"), "by": by}
        write_json(path, stones)


def footage_withdrawals(slug, d, l):
    """Live footage Stacks no longer offers: clips that left a READY draft package (a re-trim or an un-pick) and
    libraries whose package left the drafts folder. Removal never needs Sam's tap (SPEC §23 v2); nothing here is
    tombstoned, because a later pick in Stacks is Sam's own new choice. Never while the draft book or the drafts
    folder is missing (a sync glitch must not empty a client's library)."""
    if "org" not in d or not os.path.isdir(os.path.join(LIBRARY_DRAFTS, slug)):
        return []
    out = []
    for k in l:
        if k.startswith("library:") and k not in d:
            out.append(k)
        elif k.startswith("clip:") and k not in d and f"library:{k.split(':', 1)[1].split('/', 1)[0]}" in d:
            out.append(k)
    return out


def pending_digest(d, keys):
    """A short fingerprint of exactly what a ticket shows; `approve --digest` refuses if anything changed since."""
    return hashlib.sha256(json.dumps({k: digest(d[k][1]) for k in sorted(keys)}, sort_keys=True).encode()).hexdigest()[:12]


def tombstones(slug):
    return load(os.path.join(LIBRARY_LIVE, slug, "_tombstones.json")) or {}


def write_preview(slug):
    """A preview exists only while something is waiting for Sam; otherwise it's removed (and the site hides it)."""
    draft, live, d, l, new, changed, removed = diff(slug)
    path = os.path.join(PREVIEW, f"{slug}--preview.json")
    lib_folder = os.path.join(LIBRARY_PREVIEW, f"{slug}--preview")
    if not d or not (new or changed):
        if os.path.exists(path):
            os.remove(path)
        clear_library_preview(lib_folder, keep=())
        return None
    items = {k: v for k, v in d.items() if not k.startswith("person:")}
    book = assemble(draft, items, list(d))
    book["org"] = dict(book["org"], slug=f"{slug}--preview")
    book["people"] = []
    for inv in book["invoices"]:
        inv["number"] = f"{inv['number']} (preview)"
    write_json(os.path.join(PREVIEW, f"{slug}--preview.json"), book)
    # Staff see pending footage on the preview site too (the worker's screenshots come from there).
    libs = assemble_libraries(items, list(d))
    for key, pkg in libs.items():
        write_json(os.path.join(lib_folder, f"{key}.json"), dict(pkg, org=f"{slug}--preview"))
    clear_library_preview(lib_folder, keep=libs)
    return book


def clear_library_preview(folder, keep):
    """The preview's footage folder holds only what the current preview shows."""
    if os.path.isdir(folder):
        for name in os.listdir(folder):
            if name.endswith(".json") and name[:-5] not in keep:
                os.remove(os.path.join(folder, name))

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
    snap = diff(a.org)
    _, _, d, l, new, changed, removed = snap
    gone = footage_withdrawals(a.org, d, l)
    if gone:
        publish(a.org, [], "auto: footage Stacks no longer offers", "auto", removing=gone, snap=snap)
        for k in gone:
            print(f"  WITHDRAWN {k:47} {l[k][0]}")
        snap = diff(a.org)
        _, _, d, l, new, changed, removed = snap
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

def _contact_value(raw):
    return e164(raw) if "@" not in raw else raw.strip().lower()


def cmd_clear_contact(a):
    value = _contact_value(a.value)
    if not value:
        raise SystemExit(f"not a phone number or an email: {a.value}")
    data = load(CLEARED) or {"version": 1, "cleared": []}
    if any(c.get("value") == value and _norm_person(c.get("person")) == _norm_person(a.person)
           and c.get("org") == a.org and not c.get("withdrawn") for c in data["cleared"]):
        print(f"already cleared: {a.person} · {value}")
        return 0
    entry = {"person": a.person, "value": value, "cleared_by": a.by, "ticket": a.ticket, "date": dt.date.today().isoformat()}
    if a.org:
        entry["org"] = a.org
    data["cleared"].append(entry)
    write_json(CLEARED, data)
    print(f"cleared for client pages: {a.person} · {value}" + (f" (only {a.org})" if a.org else ""))
    return 0


def cmd_withdraw_contact(a):
    value = _contact_value(a.value)
    if not value:
        raise SystemExit(f"not a phone number or an email: {a.value}")
    data = load(CLEARED) or {"version": 1, "cleared": []}
    hit = 0
    for c in data["cleared"]:
        if c.get("value") == value and not c.get("withdrawn"):
            c["withdrawn"] = {"by": a.by, "date": dt.date.today().isoformat()}
            hit += 1
    write_json(CLEARED, data)
    # Withdrawing doesn't change pages already live: list the live books still showing it, to take it down.
    showing = []
    if os.path.isdir(PUBLISHED):
        for name in sorted(os.listdir(PUBLISHED)):
            if name.endswith(".json"):
                text = open(os.path.join(PUBLISHED, name), encoding="utf-8").read()
                digits = value[2:] if value.startswith("+1") else None
                if (digits and digits in re.sub(r"\D", "", text)) or (not digits and value in text.lower()):
                    showing.append(name[:-5])
    print(f"withdrew {hit} clearance(s) for {value}")
    if showing:
        print("still live in: " + ", ".join(showing) + " (edit the draft, then publish or remove the item)")
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
    stones = tombstones(a.org)
    pending = [k for k in new + changed if k not in stones]
    pulled = [k for k in new + changed if k in stones]
    if not pending and not pulled:
        print(f"{name}: nothing waiting to publish.")
        return
    # Footage clips are counted per library (the staff preview's footage page shows every still and title).
    labels, clips = [], {}
    for k in pending:
        if k.startswith("clip:"):
            lib = k.split(":", 1)[1].split("/", 1)[0]
            n = clips.setdefault(lib, {"new": 0, "changed": 0})
            n["new" if k in new else "changed"] += 1
        elif k.startswith("document:") and d[k][1].get("ask") == "accept":
            c = d[k][1]
            who = " and ".join(e.split("@")[0] for e in c.get("acceptors") or [])
            total = c.get("total")
            money = (f"${total:,.0f}" if float(total).is_integer() else f"${total:,.2f}") if isinstance(total, (int, float)) else "?"
            sha8 = (c.get("frozen_sha256") or "")[:8]
            again = " (replaces the one they may be reading)" if k in changed else ""
            labels.append(f"{'New' if k in new else 'Changed'}: {d[k][0]}: puts an Accept button in front of {who} · {money} · "
                          f"good until {c.get('good_until')} · file {sha8}{again}")
        else:
            labels.append(("New: " if k in new else "Changed: ") + d[k][0])
    for lib, n in clips.items():
        title = (d.get(f"library:{lib}") or l.get(f"library:{lib}") or (lib, {}))[1].get("title") or lib
        bits = [f"{n['new']} new" if n["new"] else "", f"{n['changed']} changed" if n["changed"] else ""]
        labels.append(f"Footage in {title}: " + ", ".join(b for b in bits if b) + " clip(s); every still and title is on the preview's footage page")
    n_clips = sum(1 for k in pending if k.startswith("clip:"))
    if pending:
        print(f"{name}: {len(pending)} thing{'s' if len(pending) != 1 else ''} ready for their site. Publish? (a) Publish (b) Hold")
        for x in labels:
            print(f"  - {x}")
        print(f"  (check: {pending_digest(d, pending)}" + (f"; more than {MAX_CLIPS_PER_TICKET} clips: publish in parts" if n_clips > MAX_CLIPS_PER_TICKET else "") + ")")
    if pulled:
        print(f"  Not in this ticket, {TOMBSTONE_NOTE}:")
        for k in pulled:
            print(f"  - {d[k][0]}")


def cmd_approve(a):
    snap = diff(a.org)
    _, _, d, l, new, changed, removed = snap
    stones = tombstones(a.org)
    named = [k.strip() for k in a.items.split(",")] if a.items else None
    keys = named if named is not None else [k for k in new + changed if k not in stones]
    unknown = [k for k in keys if k not in d]
    if unknown:
        raise SystemExit(f"not in the draft: {unknown}")
    if a.digest and a.digest != pending_digest(d, keys):
        raise SystemExit("refused: something changed since the ticket (its check doesn't match); make a new ticket")
    # A clip is checked against ITS library (job, org, project): never publish clips under a library change that
    # isn't being approved with them.
    lonely = sorted({k.split(":", 1)[1].split("/", 1)[0] for k in keys if k.startswith("clip:")}
                    - {k.split(":", 1)[1] for k in keys if k.startswith("library:")})
    lonely = [lib for lib in lonely if f"library:{lib}" in new + changed]
    if lonely:
        raise SystemExit(f"refused: library changes waiting for {', '.join(lonely)}: approve library:<key> with its clips")
    n_clips = sum(1 for k in keys if k.startswith("clip:") and (k in new or k in changed))
    if n_clips > MAX_CLIPS_PER_TICKET:
        raise SystemExit(f"{n_clips} footage clips in one ticket: at most {MAX_CLIPS_PER_TICKET} (publish in parts with "
                         "--items, so every still is on a ticket Sam can actually look at)")
    probs = lint(a.org, keys, snap=snap)
    if probs:
        for k, ps in probs.items():
            for p in ps:
                print(f"  {k}: {p}", file=sys.stderr)
        raise SystemExit("lint failed: nothing published")
    # Footage Stacks stopped offering (a re-trim, an un-pick) comes down in the same publish: never left live.
    publish(a.org, keys, a.by, a.ticket, removing=footage_withdrawals(a.org, d, l), snap=snap)
    print(f"{a.org}: published {len(keys)} item(s); live within 5 minutes")


def cmd_remove(a):
    keys = [k.strip() for k in a.items.split(",")]
    snap = diff(a.org)
    not_live = [k for k in keys if k not in snap[3]]
    if not_live:
        raise SystemExit(f"not on the live site (check the key): {not_live}")
    publish(a.org, [], a.by, a.ticket or "removal", removing=keys, snap=snap, tombstone=keys)
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
    s.add_argument("--digest", help="the ticket's check: refuse if anything changed since Sam saw it")
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
    s = sub.add_parser("clear-contact")
    s.add_argument("--person", required=True)
    s.add_argument("--value", required=True)
    s.add_argument("--by", required=True)
    s.add_argument("--ticket", required=True)
    s.add_argument("--org")
    s = sub.add_parser("withdraw-contact")
    s.add_argument("--value", required=True)
    s.add_argument("--by", required=True)
    a = ap.parse_args()
    rc = {"status": cmd_status, "lint": cmd_lint, "preview": cmd_preview, "ticket": cmd_ticket,
          "approve": cmd_approve, "remove": cmd_remove, "auto": cmd_auto, "undo": cmd_undo,
          "clear-contact": cmd_clear_contact, "withdraw-contact": cmd_withdraw_contact}[a.cmd](a)
    sys.exit(rc or 0)


if __name__ == "__main__":
    main()
