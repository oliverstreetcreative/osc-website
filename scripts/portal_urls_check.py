#!/usr/bin/env python3
"""Every URL "OSC - Forms" answers on portal.oliverstreetcreative.com, before and after osc-app takes the name
(client-website SPEC §33). 🤖 Stdlib only, read-only: GETs, no cookies, nothing written but the snapshot.

  python3 scripts/portal_urls_check.py snapshot https://portal.oliverstreetcreative.com <dir>
  python3 scripts/portal_urls_check.py compare  <base> <dir>
      <base> = osc-app's own Railway name BEFORE the move (its proxy must answer like Forms), then
               https://portal.oliverstreetcreative.com AFTER the move.
      Run snapshot/compare on https://hub.oliverstreetcreative.com too (its own <dir>): the move must not touch it.
  python3 scripts/portal_urls_check.py pair <base A> <base B> < links.txt
      Real shoot-day links (from a calendar invite: they carry a key, so they come on STDIN, one per line, never argv
      or disk, and are printed cut to their first segments). Each is fetched from both bases NOW and compared, e.g.
      osc-app (proxy) against https://hub.oliverstreetcreative.com (Forms itself). Day pages and their PDFs, read-only.

The fixed list: every route family Forms serves there (the old portal, the hub and its doors, shoot days, invoicing,
fonts, static files, its own pages), with REAL job codes read from Dropbox. Each is compared on status, redirect
target, content type, the NAMES of the cookies it sets, and the body with per-request bits taken out.
`/` and `/client` are reported, not judged: osc-app changes them on purpose (the client site's front door and Home).
Known, harmless differences (design review 10/8): a trailing-slash URL gets Next's 308 instead of Forms' 307 to the
same place, and Forms' /openapi.json now goes to the public site. Exit 0 = every other URL answers the same.
"""
import difflib
import glob
import json
import os
import re
import sys
import urllib.error
import urllib.request
from urllib.parse import urlsplit

CHANGES_ON_PURPOSE = {"/", "/client"}
FIXED = ["/", "/client", "/crew", "/crew/x", "/hub", "/hub/login", "/hub/logout", "/hub/exit-view-as", "/hub/auth/not-a-real-token",
         "/portal", "/portal/login", "/portal/start", "/portal/library", "/portal/logo/osc-internal", "/portal/auth/not-a-real-token",
         "/portal/p/not-a-stem", "/invoice/auth/not-a-real-token", "/healthz", "/sw.js", "/start-a-project",
         "/static/logo.svg", "/static/banner.png", "/static/hub/hub.css", "/static/hub/hub.js", "/static/hub/day.css",
         "/static/hub/day.js", "/static/hub/icon-192.png", "/static/missing.css", "/hub-fonts/missing.woff2"]


def dropbox_root():
    for r in (os.environ.get("DROPBOX_LOCAL_ROOT"), os.path.expanduser("~/Library/CloudStorage/Dropbox/OLIVER STREET CREATIVE"),
              os.path.expanduser("~/Dropbox (Personal)/OLIVER STREET CREATIVE"), "/Volumes/dropbox-sam/OLIVER STREET CREATIVE"):
        if r and os.path.isdir(r):
            return r
    return None


def real_urls():
    """Job codes from the AP files and their shoot days from project.json; one real hub font name. (A day URL without
    its key answers Forms' own refusal: that answer must match too. Real day pages go through `pair`.)"""
    out = []
    root = dropbox_root()
    if root:
        for f in sorted(glob.glob(os.path.join(root, "_admin", "invoicing", "*.json"))):
            code = os.path.basename(f)[:-5]
            if not re.fullmatch(r"\d{2}-\d{3}", code):
                continue
            out.append(f"/invoice/{code}")
            for pj in glob.glob(os.path.join(root, "Clients", "*", f"*{code}*", "project.json"))[:1]:
                try:
                    days = [d.get("date") for d in json.load(open(pj)).get("days", []) if isinstance(d, dict)]
                except Exception:  # noqa: BLE001
                    days = []
                for d in [x for x in days if x][:3]:
                    out += [f"/day/{code}/{d}", f"/day/{code}/{d}/state"]
    hub_day = os.path.expanduser("~/code/oliver-street-skills/servers/forms/hub_day.py")
    if os.path.exists(hub_day):
        m = re.search(r'_FONTS\s*=\s*\{\s*"([^"]+)"', open(hub_day, encoding="utf-8").read())
        if m:
            out.append(f"/hub-fonts/{m.group(1)}")
    return out


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *a, **k):
        return None


def fetch(url):
    opener = urllib.request.build_opener(NoRedirect)
    req = urllib.request.Request(url, headers={"user-agent": "osc-portal-urls-check (read-only)"})
    try:
        with opener.open(req, timeout=45) as r:
            return r.status, r.headers, r.read()
    except urllib.error.HTTPError as e:
        return e.code, e.headers, e.read()
    except Exception as e:  # noqa: BLE001
        return 0, {}, str(e).encode()


def cookie_names(headers):
    out = []
    for k, v in (headers.items() if hasattr(headers, "items") else []):
        if k.lower() == "set-cookie":
            out.append(v.split("=", 1)[0].strip())
    return sorted(set(out))


def norm(body, ctype):
    if not ctype.startswith(("text/", "application/json", "application/javascript")):
        return f"<{len(body)} bytes>"  # binary: the size says enough
    s = body.decode("utf-8", "replace")
    s = re.sub(r'(name="(?:csrf|_csrf|token|nonce)[^"]*"\s+value=")[^"]+', r"\1X", s)
    s = re.sub(r'nonce="[^"]+"', 'nonce="X"', s)
    s = re.sub(r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})?", "TIME", s)
    s = re.sub(r"\b\d{1,2}:\d{2}\s?(AM|PM|am|pm)\b", "CLOCK", s)
    return re.sub(r"\s+", " ", s).strip()


def one(base, path):
    status, h, body = fetch(base + path)
    ctype = (h.get("content-type") if hasattr(h, "get") else "") or ""
    loc = h.get("location") if hasattr(h, "get") else None
    if loc:
        parts = urlsplit(loc)
        loc = loc if parts.netloc and parts.netloc not in (urlsplit(base).netloc,) else (parts.path + (f"?{parts.query}" if parts.query else ""))
    return {"status": status, "location": loc, "type": ctype.split(";")[0], "cookies": cookie_names(h), "body": norm(body, ctype)}


def capture(base):
    return {p: one(base, p) for p in FIXED + real_urls()}


def differ(a, b, safe=False):
    """'' when the two answers are the same, else what differs. EXACT after norm() (built review #6: a fuzzy score
    called two pages with names swapped "the same"); no answer at all is never "the same". `safe` cuts redirect
    targets, for keyed links."""
    if a["status"] == 0 or b["status"] == 0:
        return "no answer (network error)"
    heads = [k for k in ("status", "location", "type", "cookies") if a[k] != b[k]]

    def show(k, v):
        return cut(v) if safe and k == "location" and v else v
    out = "; ".join(f"{k} {show(k, a[k])} → {show(k, b[k])}" for k in heads)
    if a["body"] != b["body"]:
        sm = difflib.SequenceMatcher(None, a["body"], b["body"], autojunk=False)
        i = next((op[1] for op in sm.get_opcodes() if op[0] != "equal"), 0)
        where = "" if safe else f" near …{a['body'][max(0, i - 40):i + 40]!r}"
        out += ("; " if out else "") + "body differs" + where
    return out


def cut(path):
    """A keyed link, printed safely: its first three segments, then the last one if it's a known tail."""
    segs = path.split("?")[0].split("/")
    tail = f"/…/{segs[-1]}" if len(segs) > 5 and segs[-1] in ("pdf", "state") else "/…"
    return "/".join(segs[:4]) + (tail if len(segs) > 4 or "?" in path else "")


def pair(base_a, base_b):
    paths = []
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        u = urlsplit(line)
        paths.append((u.path or "/") + (f"?{u.query}" if u.query else "") if u.scheme else line)
    if not paths:
        sys.exit("no links on stdin")
    bad = 0
    for p in paths:
        page, query = p.split("?")[0].rstrip("/"), (f"?{p.split('?', 1)[1]}" if "?" in p else "")
        # the day page (/day/<code>/<date>/<key>), its PDF and its live state
        for q in (p, f"{page}/pdf{query}", f"{page}/state{query}"):
            a, b = one(base_a, q), one(base_b, q)
            d = differ(a, b, safe=True) or ("" if a["status"] == 200 else f"both answered {a['status']}, not a real page")
            bad += bool(d)
            print(f"  {'SAME' if not d else 'DIFF'} {cut(q)} ({a['status']} {a['type']})" + (f": {d}" if d else ""))
    print("REAL DAY PAGES ANSWER THE SAME" if not bad else f"{bad} REAL PAGE(S) DIFFER")
    sys.exit(1 if bad else 0)


def main():
    if len(sys.argv) == 4 and sys.argv[1] == "pair":
        return pair(sys.argv[2].rstrip("/"), sys.argv[3].rstrip("/"))
    if len(sys.argv) != 4 or sys.argv[1] not in ("snapshot", "compare"):
        sys.exit(__doc__)
    cmd, base, folder = sys.argv[1], sys.argv[2].rstrip("/"), sys.argv[3]
    path = os.path.join(folder, "portal-urls.json")
    if cmd == "snapshot":
        os.makedirs(folder, exist_ok=True)
        snap = capture(base)
        json.dump(snap, open(path, "w"), indent=1)
        print(f"snapshot of {len(snap)} URLs from {base} → {path}")
        for p, v in snap.items():
            print(f"  {v['status']} {p}" + (f" → {v['location']}" if v["location"] else ""))
        return
    before, after, bad = json.load(open(path)), capture(base), 0
    for p, a in before.items():
        b = after.get(p)
        if b is None:
            print(f"  MISSING {p}")
            bad += 1
            continue
        if p in CHANGES_ON_PURPOSE:
            print(f"  ON PURPOSE {p}: {a['status']} {a['location'] or ''} → {b['status']} {b['location'] or ''}")
            continue
        d = differ(a, b)
        bad += bool(d)
        print(f"  {'SAME' if not d else 'DIFF'} {p}" + (f": {d}" if d else ""))
    print("EVERY FORMS URL ANSWERS THE SAME" if not bad else f"{bad} URL(S) ANSWER DIFFERENTLY")
    sys.exit(1 if bad else 0)


if __name__ == "__main__":
    main()
