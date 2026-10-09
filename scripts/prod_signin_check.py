#!/usr/bin/env python3
"""The post-deploy sign-in check: a real code sign-in as a test client, then read-only looks (client-website SPEC §26
v3). 🤖 Stdlib only. The code comes on STDIN (never argv), and nothing secret is ever printed.

  python3 scripts/prod_signin_check.py request <base> <email>
      asks the site to email a sign-in code (the same as typing the address on /login)
  python3 scripts/prod_signin_check.py check <base> <email> --org "<their org's name>" [--never "A,B,C"] [--staging] < code
      signs in with the 6-digit code, then: Home shows their org and none of the --never names (other clients); the
      projects, documents, billing and Start-a-project pages load and leak none of them either; production carries no
      staging gate; signing out ends the session. Exit 0 = all passed.
      --staging: enter staging's password gate first (STAGING_PASSWORD, else the Keychain), for a dry run there.

Writes nothing but the sign-in itself (a session row) and its sign-out.
"""
import http.cookiejar
import json
import os
import re
import subprocess
import sys
import urllib.error
import urllib.parse
import urllib.request

fails = 0


def step(ok, what, detail=""):
    global fails
    print(f"{'PASS' if ok else 'FAIL'} {what}" + (f" — {detail}" if detail else ""))
    fails += 0 if ok else 1
    return ok


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *a, **k):
        return None


def main():
    if len(sys.argv) < 4 or sys.argv[1] not in ("request", "check"):
        sys.exit(__doc__)
    cmd, base, email = sys.argv[1], sys.argv[2].rstrip("/"), sys.argv[3].strip().lower()
    jar = http.cookiejar.CookieJar()
    opener = urllib.request.build_opener(NoRedirect, urllib.request.HTTPCookieProcessor(jar))

    def call(path, method="GET", body=None, form=None):
        headers = {"Origin": base, "Referer": base + "/login", "user-agent": "osc-signin-check"}
        data = None
        if body is not None:
            data = json.dumps(body).encode()
            headers["Content-Type"] = "application/json"
        elif form is not None:
            data = urllib.parse.urlencode(form).encode()
            headers["Content-Type"] = "application/x-www-form-urlencoded"
        try:
            with opener.open(urllib.request.Request(base + path, data=data, method=method, headers=headers), timeout=40) as r:
                return r.status, {k.lower(): v for k, v in r.headers.items()}, r.read().decode("utf-8", "replace")
        except urllib.error.HTTPError as e:
            return e.code, {k.lower(): v for k, v in e.headers.items()}, e.read().decode("utf-8", "replace")

    if "--staging" in sys.argv:
        pw = (os.environ.get("STAGING_PASSWORD") or "").strip() or subprocess.run(
            ["security", "find-generic-password", "-s", "osc-staging-password", "-a", "sam", "-w"],
            capture_output=True, text=True).stdout.strip()
        s, _, _ = call("/staging-gate/enter", "POST", form={"username": "osc", "password": pw, "next": "/login"})
        del pw
        if not step(s == 303, "past staging's gate (dry run on staging)", str(s)):
            sys.exit(1)

    if cmd == "request":
        s, _, _ = call("/api/auth/request-magic-link", "POST", body={"email": email, "redirect": "/client"})
        step(s == 200, "the site was asked to email a sign-in code", str(s))
        sys.exit(1 if fails else 0)

    org = sys.argv[sys.argv.index("--org") + 1] if "--org" in sys.argv else None
    never = [x.strip() for x in (sys.argv[sys.argv.index("--never") + 1] if "--never" in sys.argv else "").split(",") if x.strip()]
    code = re.sub(r"\D", "", sys.stdin.readline())
    if not step(len(code) == 6, "a 6-digit code on stdin"):
        sys.exit(1)
    s, _, body = call("/api/auth/code", "POST", body={"email": email, "code": code})
    del code
    signed = any(c.name in ("__Host-osc_session", "osc_session") for c in jar)
    if not step(s == 200 and signed, "signed in with the code", str(s)):
        sys.exit(1)

    def text(b):
        return re.sub(r"<!-- -->", "", b)

    s, _, home = call("/client")
    step(s == 200 and (org is None or org in text(home)), "Home shows their own organization", f"{s}")
    for path in ("/client", "/client/projects", "/client/documents", "/client/billing", "/client/start"):
        s, h, b = call(path)
        leaked = [n for n in never if n in text(b)]
        step(s in (200, 307, 308) and not leaked, f"{path} loads and shows no other client", f"{s}" + (f" LEAKED {leaked}" if leaked else ""))
    if "--staging" not in sys.argv:
        s, h, b = call("/")
        step("data-staging-gate" not in b and not h.get("x-robots-tag"), "production carries no staging gate and no noindex", f"{s}")
        s, h, _ = call("/staging-gate")
        # 404 on the public site; osc-app (SPEC §33) sends every non-app path to the public site instead
        to_public = s == 308 and (h.get("location") or "").startswith("https://oliverstreetcreative.com/")
        step(s == 404 or to_public, "the staging gate's page doesn't exist on production", f"{s} {h.get('location') or ''}".strip())
    s, _, _ = call("/client/signout", "POST", form={})
    step(s in (302, 303, 307), "signed out", str(s))
    s, h, _ = call("/client")
    step(s in (302, 303, 307) and "/login" in (h.get("location") or ""), "after signing out, /client asks to sign in again", f"{s}")
    print("SIGN-IN CHECK", "OK" if not fails else f"{fails} FAILED")
    sys.exit(1 if fails else 0)


if __name__ == "__main__":
    main()
