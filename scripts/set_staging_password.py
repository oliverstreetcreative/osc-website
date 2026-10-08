#!/usr/bin/env python3
"""Make (or rotate) staging's password (client-website SPEC §32 v2). It never prints the password. 🤖

    python3 scripts/set_staging_password.py --check   is there one, and is the Keychain's the one on Railway staging?
    python3 scripts/set_staging_password.py --new     make a new one: Keychain, then Railway STAGING

--new:
  1. 24 URL-safe random characters.
  2. The Keychain: service osc-staging-password, account sam (`security -i`: the command goes on stdin, never argv).
  3. Railway, STAGING ONLY: project exciting-determination, environment staging, service osc-website, variable
     STAGING_PASSWORD (`railway variable set --stdin --skip-deploys`): the next deploy picks it up, nothing restarts.
  4. Reads both back and compares hashes.
Prints only facts (present, length, match), never a value. A new password ends every pass (every browser meets the
gate again); the drivers read the new one from the Keychain. The username Safari saves with it: osc.
"""
import argparse
import hashlib
import json
import secrets
import subprocess
import sys

SERVICE, ACCOUNT = "osc-staging-password", "sam"
PROJECT = "35f8c18b-7fdf-4204-9eef-e633778e0fd8"  # Railway "exciting-determination"
ENVIRONMENT, RAILWAY_SERVICE, VARIABLE = "staging", "osc-website", "STAGING_PASSWORD"
assert ENVIRONMENT == "staging"  # this script never touches production


def digest(s):
    return hashlib.sha256(s.encode()).hexdigest() if s else None


def keychain_get():
    r = subprocess.run(["security", "find-generic-password", "-s", SERVICE, "-a", ACCOUNT, "-w"], capture_output=True, text=True)
    return r.stdout.strip() if r.returncode == 0 else None


def keychain_set(pw):
    # `security -i` reads its command from stdin, so the password never appears in any process's argv.
    cmd = f"add-generic-password -U -s {SERVICE} -a {ACCOUNT} -l {SERVICE} -w {pw}\n"
    r = subprocess.run(["security", "-i"], input=cmd, capture_output=True, text=True)
    return r.returncode == 0


def railway_get():
    r = subprocess.run(["railway", "variable", "list", "--json", "-p", PROJECT, "-e", ENVIRONMENT, "-s", RAILWAY_SERVICE],
                       capture_output=True, text=True, timeout=90)
    if r.returncode != 0:
        return None, f"railway variable list failed ({r.returncode})"
    try:
        data = json.loads(r.stdout)  # holds raw values: never printed
    except json.JSONDecodeError:
        return None, "railway variable list: not JSON"
    if isinstance(data, dict):
        v = data.get(VARIABLE)
    else:
        v = next((x.get("value") for x in data if isinstance(x, dict) and x.get("name") == VARIABLE), None)
    return (v.strip() if isinstance(v, str) else None), None


def railway_set(pw):
    r = subprocess.run(["railway", "variable", "set", VARIABLE, "--stdin", "--skip-deploys", "-p", PROJECT, "-e", ENVIRONMENT,
                        "-s", RAILWAY_SERVICE], input=pw, capture_output=True, text=True, timeout=90)
    said = (r.stdout + r.stderr).replace(pw, "[hidden]").strip()[-300:]
    return r.returncode == 0, said


def check():
    k = keychain_get()
    rv, err = railway_get()
    print(f"Keychain {SERVICE}/{ACCOUNT}: {'present, %d characters' % len(k) if k else 'absent'}")
    print(f"Railway {ENVIRONMENT} {RAILWAY_SERVICE} {VARIABLE}: {err or ('present, %d characters' % len(rv) if rv else 'absent')}")
    same = bool(k) and digest(k) == digest(rv)
    print("match" if same else "MISMATCH or missing")
    return 0 if same and len(k) >= 16 else 1


def new():
    pw = secrets.token_urlsafe(18)
    while pw[0] in "-_":  # never starts like an option
        pw = secrets.token_urlsafe(18)
    if not keychain_set(pw) or digest(keychain_get()) != digest(pw):
        print("Keychain write FAILED; nothing sent to Railway")
        return 1
    print(f"Keychain {SERVICE}/{ACCOUNT}: written ({len(pw)} characters)")
    ok, said = railway_set(pw)
    print(f"Railway {ENVIRONMENT} {RAILWAY_SERVICE} {VARIABLE}: {'set (no deploy triggered)' if ok else 'FAILED: ' + said}")
    del pw
    return check() if ok else 1


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    g = ap.add_mutually_exclusive_group(required=True)
    g.add_argument("--check", action="store_true")
    g.add_argument("--new", action="store_true")
    a = ap.parse_args()
    sys.exit(check() if a.check else new())
