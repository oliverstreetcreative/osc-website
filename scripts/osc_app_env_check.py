#!/usr/bin/env python3
"""osc-app's settings, checked without printing a value (client-website SPEC §33). 🤖

  railway variable list -p <osc-app project> -e production -s osc-app --kv | python3 scripts/osc_app_env_check.py

STOPs on anything missing, wrong or dangerous; NOTEs what's dormant. Exit 0 = "osc-app env OK".
"""
import re
import sys

APP = "https://portal.oliverstreetcreative.com"
REQUIRED = ["DATABASE_URL", "SESSION_JWT_SECRET", "RESEND_API_KEY", "DROPBOX_APP_KEY", "DROPBOX_APP_SECRET",
            "DROPBOX_REFRESH_TOKEN", "DROPBOX_ROOT_PREFIX", "APP_ORIGIN", "FORMS_ORIGIN", "LOGIN_HOST"]
EXACT = {
    "APP_ORIGIN": APP,
    "LOGIN_HOST": "portal.oliverstreetcreative.com",
    "CLIENT_SITE_SYNC": "1",
    "CLIENT_SITE_DB_PUSH": "1",  # osc-app's own database gets its schema at boot (built review #5)
    "SITE_ENV": "production",  # every fail-closed rule keys on it (built review #2)
}
NEVER = {
    "STAGING_PASSWORD": "staging's password gate",
    "CLIENT_DEMO_TOKEN": "the staging demo",
    "DROPBOX_LOCAL_ROOT": "reads Dropbox from a local disk",
    "DROPBOX_ACCESS_TOKEN": "a static token that overrides the refresh flow",
    "SESSION_COOKIE_DOMAIN": "a cross-subdomain session cookie",
    "GATE_TEST_SANDBOX": "a test-only switch",
    "SIGN_SHOW_SAMPLES": "staging-only sample paper",
    "PUBLISH_SECRET": "the retired publish route",
    "CLIENT_SITE_SKIP_DB_PUSH": "a staging-only schema switch",
    "CREW_PORTAL_URL": "the old /crew rewrite; osc-app's routing table already sends /crew to Forms",
}
WANTED = {
    "SCRIPT_HUB_SECRET": "the shoot-day hub can't fetch scripts from here (set it when the hub points at osc-app, from the hub's own value)",
    "MUX_SIGNING_KEY_ID": "footage says 'unavailable' (needs MUX_SIGNING_KEY or MUX_SIGNING_KEY_B64 with it)",
    "SIGN_HERE_URL": "paperwork says 'unavailable' (the LIVE Sign Here and its portal token, never staging's)",
}


def read_env(stream):
    out = {}
    for line in stream:
        m = re.match(r"^\s*(?:export\s+)?([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$", line.rstrip("\n"))
        if m:
            out[m.group(1)] = m.group(2).strip().strip('"').strip("'")
    return out


def check(env):
    problems, notes = [], []
    for k in REQUIRED:
        if not env.get(k):
            problems.append(f"missing {k}")
    for k, v in EXACT.items():
        if k in env and env[k] != v:
            problems.append(f"{k} must be {v!r}")
        elif k not in env:
            problems.append(f"missing {k} (must be {v!r})")
    forms = env.get("FORMS_ORIGIN", "").strip().rstrip("/")
    if not re.fullmatch(r"https://[a-z0-9-]+\.up\.railway\.app", forms):
        problems.append("FORMS_ORIGIN must be the Forms service's OWN Railway name, https://<name>.up.railway.app (never one of "
                        "our names: once that name moves here, the proxy would call itself)")
    site_env = env.get("SITE_ENV", "").lower()
    if site_env and site_env != "production":
        problems.append(f"SITE_ENV={site_env}: osc-app is production (no staging gate, no staging rules)")
    if (site_env or env.get("RAILWAY_ENVIRONMENT_NAME", "").lower()) != "production":
        problems.append("the server wouldn't know it's production (SITE_ENV=production, or Railway's production environment)")
    for k, why in NEVER.items():
        if k in env:
            problems.append(f"must not be set: {k} ({why})")
    for k, v in env.items():
        if k.endswith(("_URL", "_ORIGIN", "_HOST")) and k != "DATABASE_URL" and "staging" in v.lower():
            problems.append(f"{k} points at a staging service: production must never call staging")
    if env.get("MUX_SIGNING_KEY_ID") and not (env.get("MUX_SIGNING_KEY") or env.get("MUX_SIGNING_KEY_B64")):
        problems.append("MUX_SIGNING_KEY_ID is set without its key (MUX_SIGNING_KEY or MUX_SIGNING_KEY_B64)")
    if bool(env.get("SIGN_HERE_URL")) != bool(env.get("SIGN_HERE_SERVICE_TOKEN")):
        problems.append("SIGN_HERE_URL and SIGN_HERE_SERVICE_TOKEN go together")
    # Production fails closed when it's missing (no client at all), so absence is safe but never what's meant: say it.
    only = env.get("CLIENT_SIGNIN_ONLY")
    if only is None:
        problems.append("CLIENT_SIGNIN_ONLY is missing: set it to the test list (internal@oliverstreetcreative.com), or to "
                        "`off` when Sam opens the site to clients (missing = no client can sign in)")
    elif only.strip().lower() == "off":
        notes.append("CLIENT_SIGNIN_ONLY=off: OPEN to every client in a published book (the test phase is over)")
    else:
        listed = [x for x in only.split(",") if x.strip()]
        notes.append(f"Sam's test phase is ON: {len(listed)} client address(es) may sign in; staff and crew always")
    if env.get("CLIENT_SITE_DB_PUSH") == "1":
        notes.append("CLIENT_SITE_DB_PUSH=1: the schema is created/updated at boot (create-only; fine for osc-app's own database)")
    for k, why in WANTED.items():
        if not env.get(k):
            notes.append(f"not set {k}: {why}")
    return problems, notes


if __name__ == "__main__":
    problems, notes = check(read_env(sys.stdin))
    for n in notes:
        print(f"NOTE  {n}")
    for p in problems:
        print(f"STOP  {p}")
    print("osc-app env OK" if not problems else f"{len(problems)} problem(s): fix before going on")
    sys.exit(1 if problems else 0)
