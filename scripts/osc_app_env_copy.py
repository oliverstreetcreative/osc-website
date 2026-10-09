#!/usr/bin/env python3
"""Give osc-app its settings without a value ever reaching the screen, argv or disk (client-website SPEC §33). 🤖

  python3 scripts/osc_app_env_copy.py --from-project <id> --from-env staging --from-service osc-website \\
      --to-project <osc-app project id> [--to-env production] [--to-service osc-app] [--db-service Postgres] [--apply]

Without --apply it prints the plan (NAMES only) and changes nothing. With --apply each value goes to
`railway variable set NAME --stdin --skip-deploys` on its stdin, one name at a time.
  - COPIED from the source service (read in memory from `railway variable list --json`, never printed):
    the Dropbox app (4) and Resend; Mux's signing key too when the source has it (footage plays).
  - GENERATED here: SESSION_JWT_SECRET (osc-app's own; never staging's, so no staging session opens osc-app).
  - LITERAL: the osc-app switches (production, its origin, Forms' origin (its own Railway name, read from Railway's API
    10/8), the sign-in host, sync, schema at boot, Sam the only user).
  - REFERENCE: DATABASE_URL = ${{<db-service>.DATABASE_URL}} (Railway resolves it; the URL itself is never handled).
    `railway add --database postgres` names that service "Postgres".
Then run scripts/osc_app_env_check.py on the result.
"""
import argparse
import json
import secrets
import subprocess
import sys

COPY = ["DROPBOX_APP_KEY", "DROPBOX_APP_SECRET", "DROPBOX_REFRESH_TOKEN", "DROPBOX_ROOT_PREFIX", "RESEND_API_KEY"]
COPY_IF_THERE = ["MUX_SIGNING_KEY_ID", "MUX_SIGNING_KEY", "MUX_SIGNING_KEY_B64"]
LITERAL = {
    "SITE_ENV": "production",
    "APP_ORIGIN": "https://portal.oliverstreetcreative.com",
    "FORMS_ORIGIN": "https://osc-forms-production.up.railway.app",
    "LOGIN_HOST": "portal.oliverstreetcreative.com",
    "CLIENT_SITE_SYNC": "1",
    "CLIENT_SITE_DB_PUSH": "1",
    "CLIENT_SIGNIN_ONLY": "internal@oliverstreetcreative.com",
}


def source_vars(a):
    r = subprocess.run(["railway", "variable", "list", "--json", "-p", a.from_project, "-e", a.from_env, "-s", a.from_service],
                       capture_output=True, text=True, timeout=120)
    if r.returncode:
        sys.exit(f"couldn't read the source service's settings (exit {r.returncode}); nothing changed")
    try:
        return json.loads(r.stdout)
    except ValueError:
        sys.exit("the source's settings weren't JSON; nothing changed")


def plan(a, src):
    out = {}
    missing = [k for k in COPY if not src.get(k)]
    if missing:
        sys.exit(f"the source service lacks {', '.join(missing)}; nothing changed")
    for k in COPY:
        out[k] = ("copied", src[k])
    for k in COPY_IF_THERE:
        if src.get(k):
            out[k] = ("copied", src[k])
    out["SESSION_JWT_SECRET"] = ("generated", secrets.token_urlsafe(48))
    for k, v in LITERAL.items():
        out[k] = ("literal", v)
    out["DATABASE_URL"] = ("reference", "${{" + a.db_service + ".DATABASE_URL}}")
    return out


def main():
    p = argparse.ArgumentParser()
    for k in ("from-project", "from-env", "from-service", "to-project"):
        p.add_argument(f"--{k}", required=True)
    p.add_argument("--to-env", default="production")
    p.add_argument("--to-service", default="osc-app")
    p.add_argument("--db-service", default="Postgres")
    p.add_argument("--apply", action="store_true")
    a = p.parse_args()
    if a.to_project == a.from_project and a.to_service == a.from_service:
        sys.exit("source and target are the same service; nothing changed")
    todo = plan(a, source_vars(a))
    for k, (how, _) in todo.items():
        print(f"  {k:24} {how}" + ("" if how != "literal" or "SECRET" in k else f" = {LITERAL[k]}"))
    if not a.apply:
        print("plan only (add --apply to set these on", f"{a.to_service}/{a.to_env})")
        return
    bad = 0
    for k, (how, v) in todo.items():
        r = subprocess.run(["railway", "variable", "set", k, "--stdin", "--skip-deploys", "-p", a.to_project, "-e", a.to_env,
                            "-s", a.to_service], input=v, capture_output=True, text=True, timeout=120)
        ok = r.returncode == 0
        bad += not ok
        print(f"  {'set' if ok else 'FAILED'} {k}")
    print("all set; now: railway variable list ... --kv | python3 scripts/osc_app_env_check.py" if not bad
          else f"{bad} failed; fix and re-run (setting a name twice is harmless)")
    sys.exit(1 if bad else 0)


if __name__ == "__main__":
    main()
