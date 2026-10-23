#!/usr/bin/env python3
"""Cut a production release branch: production's main + ONLY the client site (client-website SPEC §26 v3). 🤖

  python3 scripts/make_release_branch.py <new-branch> <src-commit> [--base origin/main]

Starts <new-branch> at --base (production's main), then takes every file the client site changed in <src-commit>
(staging's head) EXCEPT the public site, the redesign, the price estimator and staging-only UI, which stay exactly
as main has them. Commits nothing: review `git status`, build, test, compare the public pages
(`scripts/public_pages_check.py`), then commit. Refuses a dirty worktree. Pushes nothing.

The EXCLUDE list is the contract (10/8): add to it whenever a new public or redesign path appears on staging.
"""
import subprocess
import sys

EXCLUDE = [
    # the public site and its shared shell: byte-for-byte as main
    "app/page.tsx", "app/layout.tsx", "app/globals.css", "app/sitemap.ts", "app/robots.ts", "public/robots.txt",
    "app/work/", "app/for/", "README.md",
    # the redesign (not launched)
    "app/service-businesses/", "app/faq/", "components/site/", "lib/home-copy", "lib/faq", "lib/hero-reel",
    "lib/logo-options", "lib/story-hours", "lib/silo-offer", "lib/tmdb", "app/api/tmdb/", "public/guides/",
    # the price estimator's pages (its constants file rides along: the client site's request kinds read it)
    "app/pricing/", "app/quote-desk/", "app/api/estimate/", "app/api/quote-desk/",
    "lib/estimator/desk-auth.ts", "lib/estimator/engine", "lib/estimator/vocab.ts",
    # staging-only UI the release's root layout never loads
    "app/staging-comment.tsx",
]


def git(*a, check=True):
    r = subprocess.run(["git", *a], capture_output=True, text=True)
    if check and r.returncode:
        sys.exit(f"git {' '.join(a)} failed: {r.stderr.strip()}")
    return r.stdout


def excluded(p):
    for e in EXCLUDE:
        if e.endswith("/"):
            if p.startswith(e):
                return True
        elif "." in e.split("/")[-1]:
            if p == e:
                return True
        elif p.startswith(e):  # a stem: lib/faq covers lib/faq.ts and lib/faq.test.ts
            return True
    return False


def main():
    if len(sys.argv) < 3:
        sys.exit(__doc__)
    branch, src = sys.argv[1], sys.argv[2]
    base = sys.argv[sys.argv.index("--base") + 1] if "--base" in sys.argv else "origin/main"
    if git("status", "--porcelain").strip():
        sys.exit("worktree not clean")
    base_sha = git("rev-parse", base).strip()
    git("checkout", "-q", "-b", branch, base_sha)
    rows = [l.split("\t") for l in git("diff", "--no-renames", "--name-status", base_sha, src).splitlines() if l.strip()]
    take, drop, kept = [], [], []
    for st, path in ((r[0], r[-1]) for r in rows):
        (kept if excluded(path) else drop if st.startswith("D") else take).append(path)
    for i in range(0, len(take), 100):
        git("checkout", src, "--", *take[i:i + 100])
    for i in range(0, len(drop), 100):
        git("rm", "-q", "--", *drop[i:i + 100])
    print(f"{branch} from {base_sha[:7]}: took {len(take)} from {src[:7]}, removed {len(drop)}, kept {len(kept)} as main")
    same = subprocess.run(["git", "diff", "--quiet", base_sha, "--", *[e.rstrip("/") for e in EXCLUDE]]).returncode == 0
    print("excluded paths identical to main:", "YES" if same else "NO (stop and look)")
    print("next: prisma generate, tsc, tests, next build (SITE_ENV=production), public-pages compare, then commit")


if __name__ == "__main__":
    main()
