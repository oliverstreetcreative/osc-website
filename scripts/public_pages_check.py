#!/usr/bin/env python3
"""Before/after proof that a release changes no public page (client-website SPEC §26 v3). 🤖 Stdlib only, read-only.

  python3 scripts/public_pages_check.py snapshot https://oliverstreetcreative.com /tmp/osc-public-before
  python3 scripts/public_pages_check.py compare  https://oliverstreetcreative.com /tmp/osc-public-before

The pages: the homepage, every URL in /sitemap.xml, the /work/<slug> pages it lists, the crew pages, robots.txt, the
sitemap itself, and the paths that must STAY 404 (the redesign's /work index, /service-businesses, /faq, /pricing).
Each page is compared as a reader sees it: its status, redirect and robots header, its HTML with scripts, preloads
and build hashes taken out, and the CSS rules that can touch it. A CSS rule that differs counts only if one of its
classes is on the page: Tailwind drops a utility when its last user goes (the old sign-in pages) and adds one for a new
page, and neither can change a page that doesn't carry that class. Exit 0 = every public page is the same.
"""
import json
import os
import re
import sys
import urllib.error
import urllib.request
from urllib.parse import urlparse

FIXED = ["/", "/casting", "/join-our-crew", "/locations", "/robots.txt", "/sitemap.xml",
         "/work/boone-county-2025", "/work/janells-story", "/work/phoenixs-story",  # main's three /work pages (10/8)
         "/work", "/service-businesses", "/faq", "/pricing", "/quote-desk", "/no-such-page"]


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *a, **k):
        return None


def fetch(url):
    opener = urllib.request.build_opener(NoRedirect)
    req = urllib.request.Request(url, headers={"user-agent": "osc-public-pages-check (read-only)"})
    try:
        with opener.open(req, timeout=60) as r:
            return r.status, dict(r.headers), r.read().decode("utf-8", "replace")
    except urllib.error.HTTPError as e:
        return e.code, dict(e.headers), e.read().decode("utf-8", "replace")


def header(h, name):
    for k, v in h.items():
        if k.lower() == name:
            return v
    return None


def norm_html(s):
    s = re.sub(r"<script\b[^>]*>.*?</script>", "", s, flags=re.S)
    s = re.sub(r"<script\b[^>]*/>", "", s)
    s = re.sub(r"<link\b[^>]*>", "", s)
    s = re.sub(r'<meta name="next-size-adjust"[^>]*>', "", s)
    s = re.sub(r"/_next/static/[^\"' )]+", "/_next/static/X", s)
    s = re.sub(r"__(className|variable)_[0-9a-f]+", r"__\1_X", s)
    # What varies on every request by design: Cloudflare's email protection (a fresh key each time) and the form
    # library's element counters on the crew pages (sp_671 → sp_745 between two fetches).
    s = re.sub(r"/cdn-cgi/l/email-protection#[0-9a-f]+", "/cdn-cgi/l/email-protection#X", s)
    s = re.sub(r'data-cfemail="[0-9a-f]+"', 'data-cfemail="X"', s)
    s = re.sub(r"(?<![A-Za-z0-9])(s[a-z])_\d+", r"\1_N", s)
    s = re.sub(r'\b(id|for|aria-labelledby|aria-describedby|aria-controls)="\d+"', r'\1="N"', s)
    s = re.sub(r">\s+<", "><", s)
    return s.strip()


def css_rules(base, html):
    hrefs = sorted(set(re.findall(r'<link[^>]+href="([^"]+\.css[^"]*)"', html)))
    rules = set()
    for h in hrefs:
        status, _, css = fetch(h if h.startswith("http") else base + h)
        if status != 200:
            continue
        css = re.sub(r"/\*.*?\*/", "", css, flags=re.S)
        css = re.sub(r"__(className|variable)_[0-9a-f]+", r"__\1_X", css)
        css = re.sub(r"/_next/static/[^\"' )]+", "/_next/static/X", css)
        for rule in re.findall(r"[^{}]+\{[^{}]*\}", css):
            rules.add(" ".join(rule.split()))
    return sorted(rules)


def page_classes(html):
    out = set()
    for m in re.finditer(r'class="([^"]*)"', html):
        out.update(m.group(1).split())
    return out


def rule_classes(rule):
    sel = rule.split("{", 1)[0]
    return {re.sub(r"\\(.)", r"\1", c) for c in re.findall(r"\.((?:\\.|[A-Za-z0-9_-])+)", sel)}


def pages(base):
    out = list(FIXED)
    status, _, xml = fetch(base + "/sitemap.xml")
    if status == 200:
        for loc in re.findall(r"<loc>\s*([^<\s]+)\s*</loc>", xml):
            p = urlparse(loc).path or "/"
            if p not in out:
                out.append(p)
    return out


def capture(base):
    snap = {}
    for p in pages(base):
        status, h, body = fetch(base + p)
        snap[p] = {"status": status, "location": header(h, "location"), "robots": header(h, "x-robots-tag"),
                   "html": norm_html(body), "classes": sorted(page_classes(body)),
                   "css": css_rules(base, body) if "text/html" in (header(h, "content-type") or "") else []}
    return snap


def main():
    if len(sys.argv) != 4 or sys.argv[1] not in ("snapshot", "compare"):
        sys.exit(__doc__)
    cmd, base, folder = sys.argv[1], sys.argv[2].rstrip("/"), sys.argv[3]
    path = os.path.join(folder, "public-pages.json")
    if cmd == "snapshot":
        os.makedirs(folder, exist_ok=True)
        snap = capture(base)
        json.dump(snap, open(path, "w"), indent=1)
        print(f"snapshot of {len(snap)} pages → {path}")
        for p, v in snap.items():
            print(f"  {v['status']} {p}")
        return
    before = json.load(open(path))
    after = capture(base)
    bad = 0
    for p, a in before.items():
        b = after.get(p)
        if b is None:
            b = dict(zip(("status", "headers", "body"), fetch(base + p)))
            b = {"status": b["status"], "location": None, "robots": None, "html": norm_html(b["body"]), "classes": [], "css": []}
        problems = []
        if (a["status"], a["location"], a["robots"]) != (b["status"], b["location"], b["robots"]):
            problems.append(f"status/redirect/robots {a['status']} {a['location']} {a['robots']} → {b['status']} {b['location']} {b['robots']}")
        if a["html"] != b["html"]:
            problems.append("HTML differs")
        on_page = set(a["classes"]) | set(b["classes"])
        touching = [r for r in set(a["css"]) ^ set(b["css"]) if rule_classes(r) & on_page or not rule_classes(r)]
        if touching:
            problems.append(f"{len(touching)} CSS rule(s) that can touch this page differ, e.g. {sorted(touching)[0][:120]}")
        bad += bool(problems)
        print(f"  {'SAME' if not problems else 'DIFF'} {p}" + ("" if not problems else ": " + "; ".join(problems)))
    for p in sorted(set(after) - set(before)):
        print(f"  NEW  {p} (status {after[p]['status']}): not in the snapshot")
    print("PUBLIC PAGES UNCHANGED" if not bad else f"{bad} PUBLIC PAGE(S) CHANGED")
    sys.exit(1 if bad else 0)


if __name__ == "__main__":
    main()
