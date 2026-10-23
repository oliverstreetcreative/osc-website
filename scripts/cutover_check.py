#!/usr/bin/env python3
"""The client site's production cut-over checks (client-website SPEC §26 v2). Majordomo runs these; production is
never touched by a worker. Nothing here prints a secret value.

  env --phase before|after < env.txt
      Paste the production service's variables (KEY=VALUE lines, values may be masked). Checks what must be there,
      what must NOT be there, and the switch: before the cut-over CLIENT_SITE_SYNC must be unset; after, "1".
  drift      CUTOVER_DB_URL=... — the database matches main's schema (exit 0), so the generated SQL applies as reviewed.
  generate   CUTOVER_DB_URL=... — writes prisma/cutover/client-site.sql: that database → this branch's schema.
  verify     CUTOVER_DB_URL=... — the database now matches this branch's schema (exit 0 = nothing left to change).
  staff      prints the SQL that lists every staff flag (run it with psql on the restored copy; the go-live ticket shows
             Sam who the first sync will demote: anyone flagged as staff who isn't in staff.json).
  people     prints the SQL (read-only, for the restored copy) that finds the published books' people who already exist
             in production with another role, switched off, or under another capitalisation: each is a question for Sam.

The database URL comes from the environment (CUTOVER_DB_URL), never the command line (argv shows in process lists).
Prisma's --exit-code: 0 = no difference, 2 = a difference, 1 = an error.
"""
import os
import re
import subprocess
import sys

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PRISMA = [os.path.join(REPO, "node_modules", ".bin", "prisma")]
if not os.path.exists(PRISMA[0]):
    PRISMA = ["node", os.path.join(REPO, "node_modules", "prisma", "build", "index.js")]

REQUIRED = ["DATABASE_URL", "SESSION_JWT_SECRET", "RESEND_API_KEY", "DROPBOX_APP_KEY", "DROPBOX_APP_SECRET",
            "DROPBOX_REFRESH_TOKEN"]
WANTED = {  # missing = that part stays dark, said plainly
    "SCRIPT_HUB_SECRET": "the shoot-day hub can't render scripts",
    "MUX_SIGNING_KEY_ID": "footage says 'unavailable' (signed Mux)",
}
NEVER = {  # each one is a known way to hurt production
    "CLIENT_DEMO_TOKEN": "the staging demo",
    "PUBLISH_SECRET": "the retired publish route",
    "CLIENT_SITE_SKIP_DB_PUSH": "a staging-only schema switch",
    "DROPBOX_ACCESS_TOKEN": "a static token that overrides the refresh flow",
    "DROPBOX_LOCAL_ROOT": "reads Dropbox from a local disk",
    "GATE_TEST_SANDBOX": "a test-only switch",
    "GATE_MUX_FIXTURE": "a test-only switch",
    "STACKS_ENGINE": "a test-only switch",
    "STACKS_EVENTS_DIR": "a test-only switch",
    "SESSION_COOKIE_DOMAIN": "a cross-subdomain session cookie (host-only is the rule; a ruling would be needed)",
    "SIGN_SHOW_SAMPLES": "staging-only: shows SAMPLE paper to clients (the code ignores it off staging; never set it)",
    "STAGING_PASSWORD": "staging's password gate (inert off staging; never copy staging's settings to production)",
}


def read_env(stream):
    out = {}
    for line in stream:
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        m = re.match(r"^(?:export\s+)?([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$", line)
        if m:
            out[m.group(1)] = m.group(2).strip().strip('"').strip("'")
    return out


def check_env(env, phase):
    problems, notes = [], []
    for k in REQUIRED:
        if not env.get(k):
            problems.append(f"missing {k}")
    for k, why in WANTED.items():
        if not env.get(k):
            notes.append(f"not set {k}: {why}")
    if env.get("MUX_SIGNING_KEY_ID") and not (env.get("MUX_SIGNING_KEY") or env.get("MUX_SIGNING_KEY_B64")):
        problems.append("MUX_SIGNING_KEY_ID without MUX_SIGNING_KEY or MUX_SIGNING_KEY_B64")
    for k, why in NEVER.items():
        if k in env:
            problems.append(f"must not be set: {k} ({why})")
    site_env = env.get("SITE_ENV", "").strip().lower()
    railway = env.get("RAILWAY_ENVIRONMENT_NAME", "").strip().lower()
    if site_env and site_env != "production":
        problems.append(f"SITE_ENV={site_env}: production would act as {site_env} (staging runs prisma db push at boot!)")
    if (site_env or railway) != "production":
        problems.append("the server wouldn't know it's production (RAILWAY_ENVIRONMENT_NAME or SITE_ENV must be production)")
    if env.get("LOGIN_HOST", "") != "oliverstreetcreative.com":
        problems.append("LOGIN_HOST must be oliverstreetcreative.com (clients sign in on the apex; cookies are host-only)")
    sync = env.get("CLIENT_SITE_SYNC")
    if phase == "before" and sync is not None:
        problems.append("CLIENT_SITE_SYNC is set: the merge itself would switch the client site on")
    if phase == "after" and sync != "1":
        problems.append("CLIENT_SITE_SYNC isn't 1: the client site is still dark")
    # Sam's test phase (10/8 ~19:40): he is the only user; no client is invited or emailed (SPEC §26 v3).
    # Presence, not truthiness: set-but-empty is the test phase failing CLOSED (no client signs in). On production a
    # MISSING switch fails closed too (SPEC §33 v2); only `off` opens the site to clients.
    only = env.get("CLIENT_SIGNIN_ONLY")
    if only is not None and only.strip().lower() == "off":
        if phase == "after":
            notes.append("CLIENT_SIGNIN_ONLY=off: every client in a published book can sign in (the test phase is over)")
    elif only is not None:
        notes.append("CLIENT_SIGNIN_ONLY is set: Sam's test phase (only staff, crew and the listed client addresses sign in; no client mail)")
    elif phase == "after":
        notes.append("CLIENT_SIGNIN_ONLY is missing: on production NO client can sign in (it fails closed); `off` opens it")
    return problems, notes


DATASOURCE = "/tmp/osc-cutover-datasource.prisma"


def live_db():
    """A datasource-only schema whose url is env("CUTOVER_DB_URL"): Prisma reads the URL from the environment, so it
    never appears in any process's argv."""
    if not os.environ.get("CUTOVER_DB_URL"):
        sys.exit("set CUTOVER_DB_URL in the environment (never on the command line)")
    with open(DATASOURCE, "w", encoding="utf-8") as f:
        f.write('datasource db {\n  provider = "postgresql"\n  url      = env("CUTOVER_DB_URL")\n}\n')
    return ["--from-schema-datasource", DATASOURCE]


def prisma(args):
    return subprocess.run(PRISMA + args, cwd=REPO).returncode


def main_schema_file():
    path = "/tmp/osc-main-schema.prisma"
    out = subprocess.run(["git", "-C", REPO, "show", "origin/main:prisma/schema.prisma"], capture_output=True, text=True)
    if out.returncode:
        sys.exit("can't read origin/main's schema (git fetch?)")
    open(path, "w", encoding="utf-8").write(out.stdout)
    return path


STAFF_SQL = """SELECT email, name, role, is_staff, portal_allowed FROM people
WHERE is_staff OR role = 'STAFF' ORDER BY email;"""

# The published books (the same tree the gate writes; DROPBOX_LOCAL_ROOT overrides it, as in client_gate.py).
PUBLISHED = os.path.join(os.environ.get("DROPBOX_LOCAL_ROOT") or os.path.expanduser(
    "~/Library/CloudStorage/Dropbox/OLIVER STREET CREATIVE"), "_admin", "client-site", "published")


def book_people(folder=None):
    """(email, org) for every person in every published REAL book. Emails lowercased, as the sync stores them."""
    import json
    folder = folder or PUBLISHED
    out = []
    for name in sorted(os.listdir(folder)):
        if not name.endswith(".json") or name.startswith(("_", "demo-", "rehearsal-")):
            continue
        with open(os.path.join(folder, name), encoding="utf-8") as f:
            book = json.load(f)
        slug = (book.get("org") or {}).get("slug") or name[:-5]
        for p in book.get("people") or []:
            email = str(p.get("email") or "").strip().lower()
            if email:
                out.append((email, slug))
    return out


def people_sql(pairs):
    """Read-only SQL for the restored copy: book people who already exist (any case), and emails that differ only by
    case. The sync keeps an existing person's ROLE (a CREW role sends their sign-in to crew.*) and switches
    portal_allowed back ON (someone may have switched it off on purpose); a mixed-case row is never found by sign-in.
    Every row it prints is a question for Sam's go-live ticket."""
    q = lambda s: "'" + s.replace("'", "''") + "'"
    lines = [
        "-- 1. Book people already in production. Expect role CLIENT, is_staff false (staff.json people excepted),",
        "--    portal_allowed true. Anything else: Sam decides before the switch.",
    ]
    if pairs:
        values = ",\n  ".join(f"({q(e)}, {q(o)})" for e, o in pairs)
        lines.append("SELECT b.org, p.email, p.role, p.is_staff, p.portal_allowed FROM people p JOIN (VALUES\n  "
                     f"{values}\n) AS b(email, org) ON lower(p.email) = b.email ORDER BY b.org, p.email;")
    else:
        lines.append("-- (no published real books found: nothing to check)")
    lines += [
        "-- 2. Emails that differ only by case (sign-in and the sync look people up by the lowercased address).",
        "SELECT lower(email) AS email, count(*) AS rows, string_agg(email, ' | ') AS spellings FROM people",
        "GROUP BY lower(email) HAVING count(*) > 1 OR bool_or(email <> lower(email)) ORDER BY 1;",
    ]
    return "\n".join(lines)


def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    cmd = sys.argv[1]
    if cmd == "env":
        phase = sys.argv[sys.argv.index("--phase") + 1] if "--phase" in sys.argv else "before"
        problems, notes = check_env(read_env(sys.stdin), phase)
        for n in notes:
            print(f"NOTE  {n}")
        for p in problems:
            print(f"STOP  {p}")
        print("env OK" if not problems else f"{len(problems)} problem(s): fix before going on")
        sys.exit(1 if problems else 0)
    if cmd == "drift":
        rc = prisma(["migrate", "diff", *live_db(), "--to-schema-datamodel", main_schema_file(), "--exit-code"])
        print("matches main's schema" if rc == 0 else "DRIFT: the database isn't main's schema; stop and look" if rc == 2 else "error")
        sys.exit(rc)
    if cmd == "generate":
        os.makedirs(os.path.join(REPO, "prisma", "cutover"), exist_ok=True)
        sys.exit(prisma(["migrate", "diff", *live_db(), "--to-schema-datamodel", "prisma/schema.prisma", "--script",
                         "--output", "prisma/cutover/client-site.sql"]))
    if cmd == "verify":
        rc = prisma(["migrate", "diff", *live_db(), "--to-schema-datamodel", "prisma/schema.prisma", "--exit-code"])
        print("schema is this branch's" if rc == 0 else "NOT DONE: differences remain" if rc == 2 else "error")
        sys.exit(rc)
    if cmd == "staff":
        print(STAFF_SQL)
        return
    if cmd == "people":
        print(people_sql(book_people()))
        return
    sys.exit(__doc__)


if __name__ == "__main__":
    main()
