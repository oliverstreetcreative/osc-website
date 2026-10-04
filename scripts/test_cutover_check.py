#!/usr/bin/env python3
"""Tests for the cut-over env check (scripts/cutover_check.py). Stdlib only; no database.

    python3 scripts/test_cutover_check.py
"""
import importlib.util
import io
import os
import unittest

spec = importlib.util.spec_from_file_location("cc", os.path.join(os.path.dirname(os.path.abspath(__file__)), "cutover_check.py"))
cc = importlib.util.module_from_spec(spec)
spec.loader.exec_module(cc)

GOOD = """DATABASE_URL=postgres://x
SESSION_JWT_SECRET=***
RESEND_API_KEY=***
DROPBOX_APP_KEY=***
DROPBOX_APP_SECRET=***
DROPBOX_REFRESH_TOKEN=***
RAILWAY_ENVIRONMENT_NAME=production
LOGIN_HOST=oliverstreetcreative.com
SCRIPT_HUB_SECRET=***
MUX_SIGNING_KEY_ID=abc
MUX_SIGNING_KEY_B64=***
"""


def check(text, phase="before"):
    return cc.check_env(cc.read_env(io.StringIO(text)), phase)


class EnvCheck(unittest.TestCase):
    def test_a_good_production_env_passes_before_and_after(self):
        self.assertEqual(check(GOOD)[0], [])
        self.assertEqual(check(GOOD + "CLIENT_SITE_SYNC=1\n", "after")[0], [])

    def test_the_switch(self):
        self.assertTrue(any("merge itself would switch" in p for p in check(GOOD + "CLIENT_SITE_SYNC=1\n")[0]))
        self.assertTrue(any("still dark" in p for p in check(GOOD, "after")[0]))

    def test_the_dangerous_ones(self):
        for line, words in (("SITE_ENV=staging", "prisma db push"), ("DROPBOX_ACCESS_TOKEN=x", "static token"),
                            ("DROPBOX_LOCAL_ROOT=/x", "local disk"), ("CLIENT_DEMO_TOKEN=x", "staging demo"),
                            ("GATE_TEST_SANDBOX=1", "test-only"), ("SESSION_COOKIE_DOMAIN=.oliverstreetcreative.com", "host-only")):
            self.assertTrue(any(words in p for p in check(GOOD + line + "\n")[0]), line)

    def test_production_must_know_it_is_production_and_sign_in_on_the_apex(self):
        text = GOOD.replace("RAILWAY_ENVIRONMENT_NAME=production", "RAILWAY_ENVIRONMENT_NAME=staging")
        self.assertTrue(any("know it's production" in p for p in check(text)[0]))
        text = GOOD.replace("LOGIN_HOST=oliverstreetcreative.com", "LOGIN_HOST=login.oliverstreetcreative.com")
        self.assertTrue(any("LOGIN_HOST" in p for p in check(text)[0]))

    def test_missing_basics_and_half_a_mux_key(self):
        self.assertTrue(any("missing DATABASE_URL" in p for p in check(GOOD.replace("DATABASE_URL=postgres://x\n", ""))[0]))
        text = GOOD.replace("MUX_SIGNING_KEY_B64=***\n", "")
        self.assertTrue(any("MUX_SIGNING_KEY_ID without" in p for p in check(text)[0]))

    def test_values_are_never_printed(self):
        problems, notes = check(GOOD + "DROPBOX_ACCESS_TOKEN=sl.SECRET-VALUE\n")
        self.assertFalse(any("SECRET-VALUE" in x for x in problems + notes))


if __name__ == "__main__":
    unittest.main(verbosity=1)
