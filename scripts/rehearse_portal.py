#!/usr/bin/env python3
"""Rehearse the client portal on STAGING as the rehearsal client (client-website SPEC §25 v2), at the protocol level,
with a real sign-in. Proves what each step returns; the phone frames are a separate pass.

  python3 scripts/rehearse_portal.py <base-url> <magic-link-token> proposal <document-key> [report.md]

`proposal` (SPEC §24 v2): Needs you card → proposal page → the frozen PDF (hash-checked) → a stale Accept is refused
→ Accept → receipt → the card is gone → Documents rows → a second Accept returns the same record. The ledger file is
checked separately (it lands within the 5-minute run). No secrets on disk: the one-time token comes as an argument and
the session lives only in memory. The rehearsal changes only the rehearsal client's own records.
"""
import hashlib
import http.cookiejar
import json
import re
import sys
import urllib.error
import urllib.parse
import urllib.request

if len(sys.argv) < 5:
    sys.exit(__doc__)
BASE, TOKEN, FEATURE, KEY = sys.argv[1].rstrip("/"), sys.argv[2], sys.argv[3], sys.argv[4]
REPORT = sys.argv[5] if len(sys.argv) > 5 else None

log, failures = [], 0


def step(ok, what, detail=""):
    global failures
    line = f"{'PASS' if ok else 'FAIL'} {what}" + (f" — {detail}" if detail else "")
    log.append(line)
    print(line)
    if not ok:
        failures += 1
    return ok


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


jar = http.cookiejar.CookieJar()
opener = urllib.request.build_opener(NoRedirect, urllib.request.HTTPCookieProcessor(jar))


def call(path, method="GET", form=None, body=None):
    headers = {"Origin": BASE, "Referer": BASE + "/client"}
    data = None
    if form is not None:
        data = urllib.parse.urlencode(form).encode()
        headers["Content-Type"] = "application/x-www-form-urlencoded"
    elif body is not None:
        data = json.dumps(body).encode()
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(BASE + path, method=method, data=data, headers=headers)
    try:
        with opener.open(req, timeout=40) as r:
            return r.status, {k.lower(): v for k, v in r.headers.items()}, r.read()
    except urllib.error.HTTPError as e:
        return e.code, {k.lower(): v for k, v in e.headers.items()}, e.read()


def text(b):
    """Page text as a reader sees it: React's <!-- --> markers between adjacent text pieces removed, entities decoded."""
    import html as _html
    return _html.unescape(re.sub(r"<!-- -->", "", b.decode("utf-8", "replace")))


# ---- sign in (a real magic-link token for the rehearsal person)
s, h, b = call("/api/auth/verify", "POST", body={"token": TOKEN})
if not step(s == 200 and any(c.name == "osc_session" for c in jar), "sign in as the rehearsal person", f"{s}"):
    sys.exit(1)

s, h, home = call("/client")
step(s == 200 and "Rehearsal" in text(home), "the rehearsal client's home page", f"{s}")
step(h.get("x-frame-options") == "SAMEORIGIN", "the page can't be framed by another site", h.get("x-frame-options", "none"))

if FEATURE == "proposal-check":
    # Re-check a proposal already accepted (the record, the receipt, idempotence), without accepting anything new.
    s, h, docs = call("/client/documents")
    m = re.search(r'/client/proposals/([0-9a-f-]{36})"', text(docs))
    if not step(bool(m), "Documents lists the proposal"):
        sys.exit(1)
    pid = m.group(1)
    s, h, page = call(f"/client/proposals/{pid}")
    am = re.search(r"/client/acceptances/([0-9a-f-]{36})", text(page))
    step("Accepted by Sam Rehearsal" in text(page) and "Accept this proposal" not in text(page) and bool(am),
         "the proposal says who accepted it, with no Accept button left")
    aid = am.group(1) if am else ""
    s, h, rec = call(f"/client/acceptances/{aid}")
    t = text(rec)
    fm = re.search(r"Fingerprint ([0-9a-f]{8})", t)
    step(s == 200 and bool(fm) and "Sam Rehearsal · OSC Rehearsal · Owner" in t, "the receipt names the file, the person and their role",
         fm.group(1) if fm else "no fingerprint")
    s, h, pdf = call(f"/client/proposals/{pid}/file")
    step(s == 200 and fm is not None and hashlib.sha256(pdf).hexdigest().startswith(fm.group(1)), "the receipt's file is the accepted bytes")
    s, h, home2 = call("/client")
    step("A proposal for you" not in text(home2), "no Needs you card for an accepted proposal")
    s, h, _ = call("/client/proposals/accept", "POST", form={"document_id": pid, "sha256": hashlib.sha256(pdf).hexdigest()})
    step(s == 303 and aid in h.get("location", ""), "another Accept returns the same record", h.get("location", ""))
elif FEATURE == "proposal":
    m = re.search(r'/client/proposals/([0-9a-f-]{36})"', text(home))
    if not step(bool(m) and "A proposal for you" in text(home), "Needs you shows the proposal to its acceptor"):
        sys.exit(1)
    pid = m.group(1)
    s, h, page = call(f"/client/proposals/{pid}")
    sha_m = re.search(r'name="sha256" value="([0-9a-f]{64})"', text(page))
    step(s == 200 and "Accept this proposal" in text(page) and bool(sha_m), "the proposal page offers Accept", f"{s}")
    step("$1,000" not in text(page) and "1,000" not in text(page), "no price on the screen (the PDF carries it)")
    sha = sha_m.group(1) if sha_m else ""
    s, h, pdf = call(f"/client/proposals/{pid}/file?v={sha[:8]}")
    got = hashlib.sha256(pdf).hexdigest()
    step(s == 200 and h.get("content-type", "").startswith("application/pdf") and got == sha,
         "the PDF served is exactly the frozen bytes", f"{s} sha {got[:12]} vs page {sha[:12]}")
    step(h.get("cache-control") == "private, no-store", "the PDF is never cached", h.get("cache-control", ""))
    s, h, _ = call("/client/proposals/accept", "POST", form={"document_id": pid, "sha256": "0" * 64})
    step(s == 303 and "why=changed" in h.get("location", ""), "an Accept for other bytes is refused (\"changed\")", h.get("location", ""))
    s, h, _ = call("/client/proposals/accept", "POST", form={"document_id": pid, "sha256": sha})
    loc = h.get("location", "")
    am = re.search(r"/client/acceptances/([0-9a-f-]{36})", loc)
    if not step(s == 303 and bool(am), "Accept records a yes and lands on the receipt", loc):
        sys.exit(1)
    aid = am.group(1)
    s, h, rec = call(f"/client/acceptances/{aid}")
    t = text(rec)
    step(s == 200 and "Accepted" in t and f"Fingerprint {sha[:8]}" in t and "Sam Rehearsal" in t and "Owner" in t,
         "the receipt names the file, the person, the org role", f"{s}")
    s, h, home2 = call("/client")
    step("A proposal for you" not in text(home2), "the Needs you card is gone once accepted")
    s, h, docs = call("/client/documents")
    step("Accepted proposal" in text(docs) and f"/client/proposals/{pid}" in text(docs), "Documents lists the proposal and its acceptance")
    s, h, _ = call("/client/proposals/accept", "POST", form={"document_id": pid, "sha256": sha})
    step(s == 303 and aid in h.get("location", ""), "a second Accept returns the same record (one per document)", h.get("location", ""))
    s, h, page2 = call(f"/client/proposals/{pid}")
    step("Accepted by Sam Rehearsal" in text(page2) and "Accept this proposal" not in text(page2), "the proposal now says who accepted it")
    print(f"acceptance id: {aid}")
elif FEATURE == "approve":
    # SPEC §13: KEY = "<project slug>/<film key>"; Review's TEST asset has two ready versions (v1, v2).
    slug, film = KEY.split("/", 1)
    t0 = text(home)
    step("Ready for your OK" in t0 and f"/client/projects/{slug}/approve/{film}" in t0 and "Version 2" in t0,
         "Needs you asks the approver for an OK on Review's newest version")
    s, h, proj = call(f"/client/projects/{slug}")
    tp = text(proj)
    step(s == 200 and "In review · Version 2" in tp and "Watch and approve" in tp and "v2" in tp,
         "the project page: in review, version 2 with Sam's bound label, Watch and approve", f"{s}")
    s, h, page = call(f"/client/projects/{slug}/approve/{film}")
    tpage = text(page)
    vid = re.search(r'name="version_id" value="([0-9a-f-]{36})"', tpage)
    vn = re.search(r'name="version_n" value="(\d+)"', tpage)
    stream = re.search(r'(https://review\.oliverstreetcreative\.com/api/stream/hls/master\.m3u8\?token=[A-Za-z0-9._~%-]+)', tpage)
    step(s == 200 and "Version 2" in tpage and bool(vid) and vn and vn.group(1) == "2", "the approve page shows Version 2 and offers Approve", f"{s}")
    step(bool(stream), "the page plays exactly that version (Review's stream, version-checked)")
    if stream:
        req = urllib.request.Request(stream.group(1), headers={"Origin": BASE})
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                acao, body = r.headers.get("Access-Control-Allow-Origin"), r.read(200)
                step(r.status == 200 and acao == BASE and body.startswith(b"#EXTM3U"), "Review serves its HLS to this site (CORS)", f"{acao}")
        except urllib.error.HTTPError as e:
            step(False, "Review serves its HLS to this site (CORS)", str(e.code))
    v1 = "a5f290a8-d3e8-4327-b9e0-fa2448f1a640"
    fid = re.search(r'name="film_id" value="([0-9a-f-]{36})"', tpage)
    s, h, _ = call("/client/review/approve", "POST", form={"film_id": fid.group(1) if fid else "", "version_id": v1, "version_n": "1", "note": ""})
    step(s == 303 and "why=newer" in h.get("location", ""), "approving a version that isn't the newest is refused (\"a newer cut\")", h.get("location", ""))
    s, h, _ = call("/client/review/approve", "POST",
                   form={"film_id": fid.group(1) if fid else "", "version_id": vid.group(1) if vid else "", "version_n": "2", "note": "Rehearsal approval"})
    loc = h.get("location", "")
    am = re.search(r"/client/approvals/([0-9a-f-]{36})", loc)
    if not step(s == 303 and bool(am), "Approve records the approval and lands on the receipt", loc):
        sys.exit(1)
    aid = am.group(1)
    s, h, rec = call(f"/client/approvals/{aid}")
    tr = text(rec)
    step(s == 200 and "Version 2 in Review · v2" in tr and "Sam Rehearsal · OSC Rehearsal" in tr and "Rehearsal approval" in tr,
         "the receipt: Review's version 2, Sam's label, who, the note", f"{s}")
    s, h, home2 = call("/client")
    step("Ready for your OK" not in text(home2), "the OK card is gone once the newest version is approved")
    s, h, page2 = call(f"/client/projects/{slug}/approve/{film}")
    step("Version 2 is approved" in text(page2) and f"/client/approvals/{aid}" in text(page2), "the approve page says it's approved, with the record")
    s, h, docs = call("/client/documents")
    step(f"/client/approvals/{aid}" in text(docs), "Documents lists the approval")
    s, h, _ = call("/client/review/approve", "POST", form={"film_id": fid.group(1) if fid else "", "version_id": vid.group(1) if vid else "", "version_n": "2", "note": ""})
    step(s == 303 and aid in h.get("location", ""), "a second Approve returns the same record", h.get("location", ""))
    print(f"approval id: {aid}")
else:
    step(False, f"unknown feature {FEATURE}")

summary = f"{len(log) - failures}/{len(log)} PASS"
print(summary)
if REPORT:
    with open(REPORT, "w", encoding="utf-8") as f:
        f.write(f"# Portal rehearsal on staging: {FEATURE} ({KEY}) 🤖\n\n{BASE} · run by the client-website worker\n\n")
        f.write("\n".join(f"- {x}" for x in log) + f"\n\n**{summary}**\n")
sys.exit(1 if failures else 0)
