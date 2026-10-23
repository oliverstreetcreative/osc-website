#!/usr/bin/env python3
"""Prove a release changes no public page BEFORE it ships (client-website SPEC §26 v3). 🤖 Local only: no database,
no secrets, nothing touches production.

  python3 scripts/compare_public_builds.py <release-branch> <main-commit>

Builds and serves production's main and the release side by side (as production), fetches every public route
(homepage, crew pages, /work pages, the paths that must stay 404, robots, sitemap), and compares each the way
scripts/public_pages_check.py does: status, redirect and robots header, the HTML with scripts and build hashes taken
out, and only the CSS rules that can touch the page. Switches the worktree between the two (refuses a dirty one) and
ends on <release-branch> with its Prisma client regenerated. Exit 0 = every public page is identical.
"""
import json
import os
import subprocess
import sys
import time
import urllib.error
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(HERE)
sys.path.insert(0, HERE)
import public_pages_check as ppc  # noqa: E402  (one normalizer for both checks)

ENV = {"PATH": os.environ["PATH"], "HOME": os.environ["HOME"], "NEXT_TELEMETRY_DISABLED": "1", "SITE_ENV": "production",
       "RAILWAY_ENVIRONMENT_NAME": "production"}
FIXED = ["/", "/casting", "/join-our-crew", "/locations", "/village/login", "/faq", "/service-businesses", "/work",
         "/pricing", "/quote-desk", "/no-such-page", "/robots.txt", "/sitemap.xml", "/for/no-such-prospect", "/f/no-such-link"]


def sh(args, **kw):
    return subprocess.run(args, cwd=REPO, capture_output=True, text=True, **kw)


def build_and_capture(ref, port, label):
    if sh(["git", "checkout", "-q", ref]).returncode:
        sys.exit(f"can't check out {ref}")
    g = sh(["node", "node_modules/prisma/build/index.js", "generate"], timeout=600)
    b = sh(["node", "node_modules/next/dist/bin/next", "build"], env=ENV, timeout=1800)
    print(f"[{label}] prisma generate {g.returncode} · build {b.returncode}")
    if b.returncode:
        sys.exit((b.stdout + b.stderr)[-3000:])
    try:
        man = json.load(open(os.path.join(REPO, ".next", "prerender-manifest.json")))
        work = sorted(p for p in man.get("routes", {}) if p.startswith("/work/"))
    except Exception:  # noqa: BLE001
        work = []
    env = {**ENV, "NODE_ENV": "production", "PORT": str(port), "SESSION_JWT_SECRET": "s" * 48}
    p = subprocess.Popen(["node", "node_modules/next/dist/bin/next", "start", "-p", str(port)], cwd=REPO, env=env,
                         stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    pages, base = {}, f"http://localhost:{port}"
    try:
        for _ in range(120):
            time.sleep(0.5)
            try:
                urllib.request.urlopen(base + "/robots.txt", timeout=2)
                break
            except Exception:  # noqa: BLE001
                pass
        for path in FIXED + work:
            status, h, body = ppc.fetch(base + path)
            pages[path] = {"status": status, "location": ppc.header(h, "location"), "robots": ppc.header(h, "x-robots-tag"),
                           "html": ppc.norm_html(body), "classes": ppc.page_classes(body),
                           "css": set(ppc.css_rules(base, body))}
    finally:
        p.terminate()
        p.wait(15)
    return pages, work


def main():
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    release, main_ref = sys.argv[1], sys.argv[2]
    if sh(["git", "status", "--porcelain"]).stdout.strip():
        sys.exit("worktree not clean")
    rel, rel_work = build_and_capture(release, 3994, "release")
    old, old_work = build_and_capture(main_ref, 3993, "main")
    sh(["git", "checkout", "-q", release])
    sh(["node", "node_modules/prisma/build/index.js", "generate"], timeout=600)
    print(f"/work pages: main {old_work} · release {rel_work}")
    bad = 0
    for path in FIXED + old_work:
        a, b = old.get(path), rel.get(path)
        if not a or not b:
            print(f"  MISSING {path}")
            bad += 1
            continue
        problems = []
        if (a["status"], a["location"], a["robots"]) != (b["status"], b["location"], b["robots"]):
            problems.append(f"status/redirect/robots {a['status']} → {b['status']}")
        if a["html"] != b["html"]:
            problems.append("HTML differs")
        on_page = a["classes"] | b["classes"]
        diff = a["css"] ^ b["css"]
        touching = [r for r in diff if ppc.rule_classes(r) & on_page or not ppc.rule_classes(r)]
        if touching:
            problems.append(f"{len(touching)} CSS rule(s) that can touch it differ, e.g. {sorted(touching)[0][:120]}")
        bad += bool(problems)
        note = f" (CSS rules differing elsewhere: {len(diff)}, none on this page)" if diff and not touching else ""
        print(f"  {'SAME' if not problems else 'DIFF'} {path}{': ' + '; '.join(problems) if problems else note}")
    print("PUBLIC PAGES IDENTICAL: YES" if not bad else f"PUBLIC PAGES IDENTICAL: NO ({bad})")
    sys.exit(1 if bad else 0)


if __name__ == "__main__":
    main()
