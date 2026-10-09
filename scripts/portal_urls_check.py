#!/usr/bin/env python3
"""Every URL "OSC - Forms" answers on portal.oliverstreetcreative.com, before and after osc-app takes the name
(client-website SPEC §33). 🤖 Stdlib only, read-only: GETs and HEADs, no cookies, nothing written anywhere.

  python3 scripts/portal_urls_check.py snapshot https://portal.oliverstreetcreative.com <dir>
  python3 scripts/portal_urls_check.py compare  <base> <dir>
      <base> = osc-app's own Railway name BEFORE the move (its proxy must answer like Forms), then
               https://portal.oliverstreetcreative.com AFTER the move.

The URLs: every route family Forms serves there (the old portal, the hub and its doors, shoot days, invoicing, fonts,
static files, its own pages), with REAL job codes and shoot days read from Dropbox. Each is compared on status,
redirect target, content type, the NAMES of the cookies it sets, and the body with per-request bits taken out.
`/` and `/client` are reported, not judged: osc-app changes them on purpose (the client site's front door and Home).
Exit 0 = every other URL answers the same.
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
    """Job codes from the AP files and their shoot days from project.json; one real hub font name."""
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


def capture(base):
    snap = {}
    for p in FIXED + real_urls():
        status, h, body = fetch(base + p)
        ctype = (h.get("content-type") if hasattr(h, "get") else "") or ""
        loc = h.get("location") if hasattr(h, "get") else None
        if loc:
            parts = urlsplit(loc)
            loc = loc if parts.netloc and parts.netloc not in (urlsplit(base).netloc,) else (parts.path + (f"?{parts.query}" if parts.query else ""))
        snap[p] = {"status": status, "location": loc, "type": ctype.split(";")[0], "cookies": cookie_names(h), "body": norm(body, ctype)}
    return snap


def main():
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
        heads = [k for k in ("status", "location", "type", "cookies") if a[k] != b[k]]
        same_body = a["body"] == b["body"] or difflib.SequenceMatcher(None, a["body"], b["body"]).quick_ratio() > 0.995
        if p in CHANGES_ON_PURPOSE:
            print(f"  ON PURPOSE {p}: {a['status']} {a['location'] or ''} → {b['status']} {b['location'] or ''}")
            continue
        ok = not heads and same_body
        bad += not ok
        detail = "; ".join(f"{k} {a[k]} → {b[k]}" for k in heads) + ("" if same_body else ("; " if heads else "") + "body differs")
        print(f"  {'SAME' if ok else 'DIFF'} {p}" + ("" if ok else f": {detail}"))
    print("EVERY FORMS URL ANSWERS THE SAME" if not bad else f"{bad} URL(S) ANSWER DIFFERENTLY")
    sys.exit(1 if bad else 0)


if __name__ == "__main__":
    main()
