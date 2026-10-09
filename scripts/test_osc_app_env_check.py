#!/usr/bin/env python3
"""Tests for osc_app_env_check.check() (fake values only). 🤖  python3 scripts/test_osc_app_env_check.py"""
import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from osc_app_env_check import check, read_env  # noqa: E402

GOOD = {
    "DATABASE_URL": "x", "SESSION_JWT_SECRET": "x", "RESEND_API_KEY": "x", "DROPBOX_APP_KEY": "x",
    "DROPBOX_APP_SECRET": "x", "DROPBOX_REFRESH_TOKEN": "x", "DROPBOX_ROOT_PREFIX": "/OLIVER STREET CREATIVE",
    "APP_ORIGIN": "https://portal.oliverstreetcreative.com", "FORMS_ORIGIN": "https://osc-forms-production.up.railway.app",
    "LOGIN_HOST": "portal.oliverstreetcreative.com", "CLIENT_SITE_SYNC": "1", "CLIENT_SITE_DB_PUSH": "1",
    "CLIENT_SIGNIN_ONLY": "internal@oliverstreetcreative.com", "SITE_ENV": "production",
}


class EnvCheck(unittest.TestCase):
    def test_the_intended_settings_pass(self):
        problems, notes = check(dict(GOOD))
        self.assertEqual(problems, [])
        self.assertTrue(any("test phase is ON: 1 client" in n for n in notes))

    def test_railways_production_environment_counts(self):
        env = dict(GOOD)
        del env["SITE_ENV"]
        self.assertEqual(check({**env, "RAILWAY_ENVIRONMENT_NAME": "production"})[0], [])
        self.assertTrue(check(env)[0])

    def test_forms_origin_only_its_own_railway_name(self):
        for bad in ("https://portal.oliverstreetcreative.com", "https://hub.oliverstreetcreative.com",
                    "https://forms.oliverstreetcreative.com", "http://osc-forms-production.up.railway.app",
                    "https://osc-forms-production.up.railway.app.evil.com", "https://x.up.railway.app/path", ""):
            problems, _ = check({**GOOD, "FORMS_ORIGIN": bad})
            self.assertTrue(any("FORMS_ORIGIN" in p for p in problems), bad)
        self.assertEqual(check({**GOOD, "FORMS_ORIGIN": "https://osc-forms-production.up.railway.app/"})[0], [])

    def test_staging_things_stop_it(self):
        for k, v in (("STAGING_PASSWORD", "x"), ("CLIENT_DEMO_TOKEN", "x"), ("CREW_PORTAL_URL", "https://x"),
                     ("SESSION_COOKIE_DOMAIN", ".oliverstreetcreative.com"), ("SITE_ENV", "staging"),
                     ("SIGN_HERE_URL", "https://sign-here-staging.up.railway.app"), ("REVIEW_API_URL", "https://review-staging.x/api")):
            self.assertTrue(check({**GOOD, k: v, "SIGN_HERE_SERVICE_TOKEN": "t"} if k == "SIGN_HERE_URL" else {**GOOD, k: v})[0], k)

    def test_pairs_go_together(self):
        self.assertTrue(check({**GOOD, "MUX_SIGNING_KEY_ID": "a"})[0])
        self.assertEqual(check({**GOOD, "MUX_SIGNING_KEY_ID": "a", "MUX_SIGNING_KEY_B64": "b"})[0], [])
        self.assertTrue(check({**GOOD, "SIGN_HERE_URL": "https://sign.oliverstreetcreative.com"})[0])

    def test_the_switch_must_be_explicit(self):
        _, notes = check({**GOOD, "CLIENT_SIGNIN_ONLY": ""})
        self.assertTrue(any("test phase is ON: 0 client" in n for n in notes))  # set but empty = closed, never "off"
        env = dict(GOOD)
        del env["CLIENT_SIGNIN_ONLY"]
        self.assertTrue(any("CLIENT_SIGNIN_ONLY is missing" in p for p in check(env)[0]))
        problems, notes = check({**GOOD, "CLIENT_SIGNIN_ONLY": "off"})
        self.assertEqual(problems, [])
        self.assertTrue(any("OPEN to every client" in n for n in notes))

    def test_reads_kv_lines(self):
        self.assertEqual(read_env(["A=1\n", "export B='two words'\n", "junk\n", 'C="x=y"\n']), {"A": "1", "B": "two words", "C": "x=y"})


if __name__ == "__main__":
    unittest.main(verbosity=1)
