#!/usr/bin/env python3
"""Tests for the publish gate (scripts/client_gate.py). Stdlib only; every test runs
the CLI against a throwaway folder (DROPBOX_LOCAL_ROOT), never the real Dropbox.

    python3 scripts/test_client_gate.py
"""
import json
import os
import shutil
import subprocess
import sys
import tempfile
import unittest

GATE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "client_gate.py")
A1 = "11111111-2222-3333-4444-555555555555"
V2 = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"
LINK = "https://review.oliverstreetcreative.com/share/AbCdEfGh12345678"


def book(versions=None, approvers=("jane@client.org",), film_extra=None):
    film = {"key": "02-appropriation", "title": "02 Appropriation :30", "audience": "client",
            "approvers": list(approvers), "approval": "any", "versions": versions or []}
    film.update(film_extra or {})
    return {
        "version": 1,
        "org": {"slug": "acme", "name": "Acme Co", "folder": "/Clients/Acme", "domains": ["client.org"],
                "audience": "client"},
        "people": [{"email": "jane@client.org", "name": "Jane Roe", "role": "APPROVER", "audience": "client"}],
        "projects": [{"key": "p1", "slug": "spots", "job_number": "26-099", "title": "Spots", "phase": "review",
                      "audience": "client", "films": [film], "shoots": []}],
        "invoices": [], "documents": [],
    }


def version(n, stage="for_approval", label=None, audience="client", **review):
    r = {"share_url": LINK, "asset_id": A1, "version_id": V2, "version_number": n}
    r.update(review)
    v = {"n": n, "stage": stage, "posted_on": "2026-10-03", "review": r, "audience": audience}
    if label:
        v["label"] = label
    return v


class GateTest(unittest.TestCase):
    def setUp(self):
        self.root = tempfile.mkdtemp(prefix="gate-test-")
        self.site = os.path.join(self.root, "_admin", "client-site")
        os.makedirs(os.path.join(self.site, "books"))

    def tearDown(self):
        shutil.rmtree(self.root, ignore_errors=True)

    def write_draft(self, b):
        with open(os.path.join(self.site, "books", "acme.json"), "w") as f:
            json.dump(b, f)

    def gate(self, *args):
        env = dict(os.environ, DROPBOX_LOCAL_ROOT=self.root)
        return subprocess.run([sys.executable, GATE, *args], capture_output=True, text=True, env=env)

    def published(self):
        with open(os.path.join(self.site, "published", "acme.json")) as f:
            return json.load(f)

    def approve_all(self, ticket="t1"):
        return self.gate("approve", "acme", "--by", "Sam", "--ticket", ticket)

    # --- audience: versions are their own facts ---
    def test_office_version_never_offered(self):
        self.write_draft(book([version(1, stage="rough", audience="office"), version(2)]))
        st = self.gate("status", "acme").stdout
        self.assertIn("version:p1/02-appropriation/2", st)
        self.assertNotIn("version:p1/02-appropriation/1", st)
        r = self.approve_all()
        self.assertEqual(r.returncode, 0, r.stderr)
        films = self.published()["projects"][0]["films"]
        self.assertEqual([v["n"] for v in films[0]["versions"]], [2])

    def test_film_item_excludes_versions(self):
        self.write_draft(book([version(1)]))
        self.approve_all()
        self.write_draft(book([version(1), version(2, stage="final")]))
        st = self.gate("status", "acme").stdout
        # Adding a version is ONE new item; the film itself is unchanged.
        self.assertIn("NEW      version:p1/02-appropriation/2", st)
        self.assertNotIn("CHANGED  film:", st)

    # --- lint ---
    def test_review_link_must_be_pinned(self):
        self.write_draft(book([version(1, asset_id="", version_id="")]))
        r = self.gate("lint", "acme")
        self.assertEqual(r.returncode, 1)
        self.assertIn("asset_id and version_id", r.stdout)

    def test_team_or_unknown_links_refused(self):
        self.write_draft(book([version(1, share_url="https://review.oliverstreetcreative.com/projects/abc")]))
        self.assertIn("not a client Review/Frame.io share link", self.gate("lint", "acme").stdout)

    def test_frameio_cannot_be_approved(self):
        self.write_draft(book([version(1, share_url="https://f.io/abc123")]))
        self.assertIn("approval needs a version-pinned Review link", self.gate("lint", "acme").stdout)

    def test_approval_needs_approvers(self):
        self.write_draft(book([version(1)], approvers=()))
        self.assertIn("needs the film's approvers list", self.gate("lint", "acme").stdout)

    def test_approver_must_be_in_book(self):
        self.write_draft(book([version(1)], approvers=("stranger@else.com",)))
        self.assertIn("isn't one of this client's people", self.gate("lint", "acme").stdout)

    def test_version_label_text_lint(self):
        self.write_draft(book([version(1, label="v1 PRELIM2 with temp music")]))
        self.assertIn("internal-draft marker", self.gate("lint", "acme").stdout)

    def test_clean_book_lints_clean(self):
        self.write_draft(book([version(1)]))
        r = self.gate("lint", "acme")
        self.assertEqual(r.returncode, 0, r.stdout)

    def test_lint_failure_blocks_approve(self):
        self.write_draft(book([version(1, version_id="nope")]))
        r = self.approve_all()
        self.assertNotEqual(r.returncode, 0)
        self.assertFalse(os.path.exists(os.path.join(self.site, "published", "acme.json")))

    # --- approved versions are records ---
    def ledger(self, n, **extra):
        d = os.path.join(self.site, "ledger", "approvals")
        os.makedirs(d, exist_ok=True)
        rec = {"job": "26-099", "film": "02-appropriation", "n": n}
        rec.update(extra)
        with open(os.path.join(d, f"approval-{n}.json"), "w") as f:
            json.dump(rec, f)

    def test_approved_version_cannot_change(self):
        self.write_draft(book([version(1)]))
        self.approve_all()
        self.ledger(1)
        self.write_draft(book([version(1, label="Renamed after approval")]))
        r = self.approve_all("t2")
        self.assertNotEqual(r.returncode, 0)
        self.assertIn("approved by the client", r.stderr + r.stdout)

    def test_approved_version_cannot_disappear_with_its_film(self):
        self.write_draft(book([version(1)]))
        self.approve_all()
        self.ledger(1)
        r = self.gate("remove", "acme", "--items", "film:p1/02-appropriation", "--by", "Sam")
        self.assertNotEqual(r.returncode, 0)
        self.assertEqual([v["n"] for v in self.published()["projects"][0]["films"][0]["versions"]], [1])

    def test_withdrawn_approval_unprotects(self):
        self.write_draft(book([version(1)]))
        self.approve_all()
        self.ledger(1, withdrawn=True)
        r = self.gate("remove", "acme", "--items", "version:p1/02-appropriation/1", "--by", "Sam")
        self.assertEqual(r.returncode, 0, r.stderr)

    # --- preview ---
    def test_preview_has_pending_version_and_no_people(self):
        self.write_draft(book([version(1)]))
        self.approve_all()
        self.write_draft(book([version(1), version(2, stage="final")]))
        self.gate("preview", "acme")
        with open(os.path.join(self.site, "preview", "acme--preview.json")) as f:
            pv = json.load(f)
        self.assertEqual(pv["people"], [])
        self.assertEqual([v["n"] for v in pv["projects"][0]["films"][0]["versions"]], [1, 2])


if __name__ == "__main__":
    unittest.main(verbosity=1)
