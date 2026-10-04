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


class GateBase(unittest.TestCase):
    def setUp(self):
        self.root = tempfile.mkdtemp(prefix="gate-test-")
        self.site = os.path.join(self.root, "_admin", "client-site")
        os.makedirs(os.path.join(self.site, "books"))

    def tearDown(self):
        shutil.rmtree(self.root, ignore_errors=True)

    def write_draft(self, b):
        with open(os.path.join(self.site, "books", "acme.json"), "w") as f:
            json.dump(b, f)

    def gate(self, *args, **env_extra):
        env = dict(os.environ, DROPBOX_LOCAL_ROOT=self.root)
        env.update(getattr(self, "env", {}))
        env.update(env_extra)
        return subprocess.run([sys.executable, GATE, *args], capture_output=True, text=True, env=env)

    def published(self):
        with open(os.path.join(self.site, "published", "acme.json")) as f:
            return json.load(f)

    def approve_all(self, ticket="t1"):
        return self.gate("approve", "acme", "--by", "Sam", "--ticket", ticket)


class GateTest(GateBase):
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

    # --- SPEC §13 v4: films read versions live from Review ---
    def test_review_link_needs_asset_id(self):
        self.write_draft(book(film_extra={"review_url": LINK}))
        self.assertIn("needs its review_asset_id", self.gate("lint", "acme").stdout)
        self.write_draft(book(film_extra={"review_url": LINK, "review_asset_id": A1}))
        r = self.gate("lint", "acme")
        self.assertEqual(r.returncode, 0, r.stdout)

    def test_ask_values_and_ok_needs_approvers_and_link(self):
        self.write_draft(book(film_extra={"ask": "approve-now"}))
        self.assertIn("ask must be one of", self.gate("lint", "acme").stdout)
        self.write_draft(book(approvers=(), film_extra={"ask": "ok", "review_url": LINK, "review_asset_id": A1}))
        self.assertIn("asking for an OK needs the film's approvers list", self.gate("lint", "acme").stdout)
        self.write_draft(book(film_extra={"ask": "ok"}))
        self.assertIn("asking for an OK needs the film's Review link", self.gate("lint", "acme").stdout)
        self.write_draft(book(film_extra={"ask": "ok", "review_url": LINK, "review_asset_id": A1}))
        r = self.gate("lint", "acme")
        self.assertEqual(r.returncode, 0, r.stdout)

    def test_ok_needs_a_job_number_and_label_binding_is_a_uuid(self):
        b = book(film_extra={"ask": "ok", "review_url": LINK, "review_asset_id": A1})
        del b["projects"][0]["job_number"]
        self.write_draft(b)
        self.assertIn("needs the project's job_number", self.gate("lint", "acme").stdout)
        self.write_draft(book(film_extra={"review_url": LINK, "review_asset_id": A1, "version": "v4",
                                          "version_review_id": "v4"}))
        self.assertIn("version_review_id must be the Review version's id", self.gate("lint", "acme").stdout)
        self.write_draft(book(film_extra={"review_url": LINK, "review_asset_id": A1, "version": "v4",
                                          "version_review_id": V2}))
        r = self.gate("lint", "acme")
        self.assertEqual(r.returncode, 0, r.stdout)

    def test_approved_film_keeps_its_review_link_but_other_fields_change(self):
        A2 = "99999999-2222-3333-4444-555555555555"
        self.write_draft(book(film_extra={"ask": "ok", "review_url": LINK, "review_asset_id": A1}))
        self.assertEqual(self.approve_all().returncode, 0)
        self.ledger(3)  # a v4 approval: Review's Version 3 of this film
        self.write_draft(book(film_extra={"ask": "none", "review_url": LINK, "review_asset_id": A1}))
        r = self.approve_all("t2")
        self.assertEqual(r.returncode, 0, r.stderr)  # Sam can stop asking
        self.write_draft(book(film_extra={"ask": "none", "review_url": LINK, "review_asset_id": A2}))
        r = self.approve_all("t3")
        self.assertNotEqual(r.returncode, 0)
        self.assertIn("approved by the client", r.stderr + r.stdout)
        r = self.gate("remove", "acme", "--items", "film:p1/02-appropriation", "--by", "Sam")
        self.assertNotEqual(r.returncode, 0)
        self.assertEqual(self.published()["projects"][0]["films"][0]["review_asset_id"], A1)

    def test_paths_cannot_climb_out_or_reach_client_site_data(self):
        os.makedirs(os.path.join(self.root, "Clients", "Other"), exist_ok=True)
        open(os.path.join(self.root, "Clients", "Other", "x.pdf"), "w").close()
        b = book()
        b["documents"] = [{"key": "d1", "kind": "other", "title": "Climb", "audience": "client",
                           "path": "/Clients/Acme/../Other/x.pdf"}]
        self.write_draft(b)
        self.assertIn("must be a plain root-relative path", self.gate("lint", "acme").stdout)
        b["documents"][0]["path"] = "/_admin/client-site/books/other.json"
        self.write_draft(b)
        self.assertIn("file outside this client's folder", self.gate("lint", "acme").stdout)
        b["documents"][0]["path"] = "/Clients/Acme//x.pdf"
        self.write_draft(b)
        self.assertIn("must be a plain root-relative path", self.gate("lint", "acme").stdout)

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

    # --- kinds, not items (SPEC §11 v2): auto + undo ---
    def live_with_status(self, status="Shooting next week."):
        b = book([version(1)])
        b["projects"][0]["status_line"] = status
        self.write_draft(b)
        self.assertEqual(self.approve_all().returncode, 0)
        return b

    def test_auto_publishes_a_clean_status_change(self):
        b = self.live_with_status()
        b["projects"][0]["status_line"] = "Cut 2 is ready."
        self.write_draft(b)
        r = self.gate("auto", "acme")
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertIn("1 published automatically", r.stdout)
        self.assertEqual(self.published()["projects"][0]["status_line"], "Cut 2 is ready.")

    def test_auto_never_publishes_new_things(self):
        b = self.live_with_status()
        b["documents"].append({"key": "d1", "kind": "other", "title": "Notes", "audience": "client"})
        self.write_draft(b)
        r = self.gate("auto", "acme")
        self.assertIn("0 published automatically", r.stdout)
        self.assertEqual(self.published()["documents"], [])

    def test_auto_holds_money_words_and_lint(self):
        b = self.live_with_status()
        b["projects"][0]["status_line"] = "Waiting on the budget for day two."
        self.write_draft(b)
        r = self.gate("auto", "acme")
        self.assertIn("HELD", r.stdout)
        self.assertIn("needs Sam's tap", r.stdout)
        self.assertEqual(self.published()["projects"][0]["status_line"], "Shooting next week.")
        b["projects"][0]["status_line"] = "See the HANDOFF."  # internal marker: lint holds it too
        self.write_draft(b)
        self.assertIn("HELD", self.gate("auto", "acme").stdout)

    def test_auto_leaves_other_fields_and_ask_ok_for_sam(self):
        b = self.live_with_status()
        b["projects"][0]["title"] = "Spots (renamed)"
        self.write_draft(b)
        self.assertIn("0 published automatically", self.gate("auto", "acme").stdout)
        b = self.live_with_status()  # reset the draft to live
        b["projects"][0]["films"][0]["ask"] = "ok"  # puts an Approve button in front of the client
        self.write_draft(b)
        self.assertIn("0 published automatically", self.gate("auto", "acme").stdout)
        b["projects"][0]["films"][0]["ask"] = "notes"
        self.write_draft(b)
        self.assertIn("1 published automatically", self.gate("auto", "acme").stdout)

    def test_undo_puts_back_one_auto_publish_unless_changed_since(self):
        b = self.live_with_status()
        b["projects"][0]["status_line"] = "Cut 2 is ready."
        self.write_draft(b)
        self.gate("auto", "acme")
        with open(os.path.join(self.site, "published", "_log", "acme.jsonl")) as f:
            at = [json.loads(x) for x in f if x.strip()][-1]["at"]
        r = self.gate("undo", "acme", "--at", at, "--by", "Sam")
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertIn("put back 1", r.stdout)
        self.assertEqual(self.published()["projects"][0]["status_line"], "Shooting next week.")
        # A second undo finds the item changed since (it's back to the old text): nothing is clobbered.
        self.assertIn("put back 0", self.gate("undo", "acme", "--at", at, "--by", "Sam").stdout)

    # --- team contacts (SPEC §21 v2): OSC's details or cleared by Sam; the +1 form is caught ---
    def team_book(self, member, status=None):
        b = book([version(1)])
        b["projects"][0]["team"] = [member]
        if status:
            b["projects"][0]["status_line"] = status
        self.write_draft(b)
        return b

    def test_team_with_osc_contacts_lints_clean(self):
        self.team_book({"name": "Sam Patton", "role": "Director", "email": "sam@oliverstreetcreative.com",
                        "phone": "+18595121419"})
        r = self.gate("lint", "acme")
        self.assertEqual(r.returncode, 0, r.stdout)

    def test_freelancer_contacts_need_clearing(self):
        self.team_book({"name": "Pat Gaffer", "role": "Gaffer", "email": "pat@gmail.com", "phone": "513-555-1234"})
        r = self.gate("lint", "acme")
        self.assertEqual(r.returncode, 1)
        self.assertIn("pat@gmail.com", r.stdout)
        self.assertIn("513-555-1234", r.stdout)
        for value in ("pat@gmail.com", "(513) 555 1234"):  # cleared in any format, matched in any format
            c = self.gate("clear-contact", "--person", "Pat Gaffer", "--value", value, "--by", "Sam", "--ticket", "T9")
            self.assertEqual(c.returncode, 0, c.stderr)
        self.assertEqual(self.gate("lint", "acme").returncode, 0)

    def test_e164_phone_in_text_is_caught(self):
        self.team_book({"name": "Sam Patton", "role": "Director"}, status="Questions? Call +15135551234.")
        r = self.gate("lint", "acme")
        self.assertEqual(r.returncode, 1)
        self.assertIn("+15135551234", r.stdout)

    def test_no_personal_address_on_a_team_card(self):
        self.team_book({"name": "Sam Patton", "role": "Director", "address": "12 Main St"})
        self.assertIn("no personal addresses", self.gate("lint", "acme").stdout)

    # --- built review 10/3: phone pattern, clearance per person, formats, withdraw ---
    def test_po_numbers_are_not_phones_but_dashes_and_slashes_are(self):
        self.team_book({"name": "Sam Patton", "role": "Director"}, status="PO 4500123456 is approved.")
        self.assertEqual(self.gate("lint", "acme").returncode, 0)  # exchange 012 can't be a phone number
        for written in ("513–555–1234", "513/555-1234", "513 555 1234"):
            self.team_book({"name": "Sam Patton", "role": "Director"}, status=f"Call {written}.")
            r = self.gate("lint", "acme")
            self.assertEqual(r.returncode, 1, written)

    def test_a_clearance_is_for_one_person(self):
        self.team_book({"name": "Pat Gaffer", "role": "Gaffer", "phone": "513-555-1234"})
        self.gate("clear-contact", "--person", "Chris Grip", "--value", "513-555-1234", "--by", "Sam", "--ticket", "T1")
        r = self.gate("lint", "acme")
        self.assertEqual(r.returncode, 1)  # cleared for Chris, not for Pat
        self.assertIn("isn't cleared for Pat Gaffer", r.stdout)
        self.gate("clear-contact", "--person", "pat gaffer", "--value", "5135551234", "--by", "Sam", "--ticket", "T2",
                  "--org", "someone-else")
        self.assertEqual(self.gate("lint", "acme").returncode, 1)  # cleared for Pat, but only for another client
        self.gate("clear-contact", "--person", "Pat Gaffer", "--value", "513 555 1234", "--by", "Sam", "--ticket", "T3")
        self.assertEqual(self.gate("lint", "acme").returncode, 0)

    def test_team_formats_and_duplicate_ids(self):
        self.team_book({"name": "Sam Patton", "role": "Director", "email": "", "id": "Sam", "mobile": "yes"})
        out = self.gate("lint", "acme").stdout
        self.assertIn("isn't an email address", out)
        self.assertIn("lowercase-kebab", out)
        self.assertIn("mobile must be true or false", out)
        b = book([version(1)])
        b["projects"][0]["team"] = [{"name": "Sam Patton", "role": "A"}, {"name": "Sam Patton", "role": "B"}]
        self.write_draft(b)
        self.assertIn("share the id", self.gate("lint", "acme").stdout)

    def test_withdraw_contact_lists_live_books(self):
        b = self.team_book({"name": "Pat Gaffer", "role": "Gaffer", "phone": "513-555-1234"})
        self.gate("clear-contact", "--person", "Pat Gaffer", "--value", "513-555-1234", "--by", "Sam", "--ticket", "T1")
        self.assertEqual(self.approve_all().returncode, 0)
        r = self.gate("withdraw-contact", "--value", "(513) 555-1234", "--by", "Sam")
        self.assertIn("withdrew 1", r.stdout)
        self.assertIn("still live in: acme", r.stdout)
        self.assertEqual(self.gate("lint", "acme").returncode, 0)  # nothing pending: the draft equals live
        b["projects"][0]["status_line"] = "Changed."
        self.write_draft(b)
        self.assertEqual(self.gate("lint", "acme").returncode, 1)  # any re-publish of that card now stops


# ---------------------------------------------------------------- footage packages (SPEC §23 v2)
STACKS_ENGINE = os.path.expanduser("~/code/stacks/engine")
CLIP_ID = "0123456789abcdef-1048576"
E1, E2, E3 = "0192ab34cd56-1a2b3c4d", "0192ab34cd57-1a2b3c4e", "0192ab34cd58-1a2b3c4f"
FPS = 23.976
ASSET, PLAYBACK = "ASSETid00000000001", "PLAYBACKid0000001"


def stacks_event(eid, a=0, b=1000, author="sam", kind="rate", rating="favorite", targets=None):
    e = {"id": eid, "clip": CLIP_ID, "kind": kind, "range": {"in_frame": a, "out_frame": b, "fps": FPS},
         "author": {"kind": author, "name": "Sam Patton" if author == "sam" else author}, "at": "2026-10-01T15:00:00Z"}
    if kind == "rate":
        e["rating"] = rating
    if targets:
        e["targets"] = targets
    return e


def clip(a=100, b=435, ev=E1, **over):
    c = {"key": f"{CLIP_ID}@{a}-{b}", "sam_event": ev, "title": "Day 1 · 10:42 AM", "taken_on": "2026-06-12", "fps": FPS,
         "mux_playback_id": PLAYBACK, "mux_asset_id": ASSET, "duration_s": round((b - a + 1) / FPS, 3), "thumb_s": 3.0,
         "aspect": "16:9"}
    c.update(over)
    return c


def package(clips=None, **over):
    p = {"format": "osc-library/2", "org": "acme", "project": "p1", "job": "26-099", "key": "june-broll",
         "title": "June shoot · B-roll", "made_by": "stacks", "made_at": "2026-10-03T20:00:00Z",
         "clips": clips if clips is not None else [clip()]}
    p.update(over)
    return p


def mux_asset(c, **over):
    a = {"status": "ready", "playback_ids": [{"id": c["mux_playback_id"], "policy": "signed"}],
         "tracks": [{"type": "video"}, {"type": "audio", "max_channels": 2}], "duration": c["duration_s"],
         "passthrough": f"26-099/{c['key']}"}
    a.update(over)
    return a


@unittest.skipUnless(os.path.isdir(os.path.join(STACKS_ENGINE, "stacks")), "Stacks' engine isn't on this Mac")
class FootageTest(GateBase):
    def setUp(self):
        super().setUp()
        self.events = os.path.join(self.root, "events")
        self.mux = os.path.join(self.root, "mux.json")
        self.env = {"STACKS_EVENTS_DIR": self.events, "GATE_MUX_FIXTURE": self.mux, "STACKS_ENGINE": STACKS_ENGINE}
        self.write_draft(book())
        self.marks(stacks_event(E1, 0, 1000))
        self.mux_assets({ASSET: mux_asset(clip())})

    def marks(self, *evs):
        d = os.path.join(self.events, CLIP_ID[:2], CLIP_ID)
        os.makedirs(d, exist_ok=True)
        for e in evs:
            with open(os.path.join(d, e["id"] + ".json"), "w") as f:
                json.dump(e, f)

    def mux_assets(self, assets):
        with open(self.mux, "w") as f:
            json.dump(assets, f)

    def write_package(self, p, name=None):
        d = os.path.join(self.site, "library", "acme")
        os.makedirs(d, exist_ok=True)
        with open(os.path.join(d, (name or p["key"]) + ".json"), "w") as f:
            json.dump(p, f)

    def live_library(self, key="june-broll"):
        path = os.path.join(self.site, "published", "library", "acme", key + ".json")
        if not os.path.exists(path):
            return None
        with open(path) as f:
            return json.load(f)

    def test_a_clean_package_publishes_a_frozen_snapshot(self):
        self.write_package(package())
        r = self.gate("lint", "acme")
        self.assertEqual(r.returncode, 0, r.stdout)
        self.assertIn("Footage clips in June shoot · B-roll: 1 new", self.gate("ticket", "acme").stdout)
        self.assertEqual(self.approve_all().returncode, 0)
        live = self.live_library()
        self.assertEqual([c["key"] for c in live["clips"]], [clip()["key"]])
        self.assertNotIn("clip_count", live)
        self.assertNotIn("CHANGED", self.gate("status", "acme").stdout)

    def test_only_sams_own_standing_favorites_pass(self):
        self.write_package(package())
        # An AI favorite over the same frames is not Sam's pick.
        shutil.rmtree(self.events)
        self.marks(stacks_event(E1, 0, 1000, author="ai"))
        self.assertIn("not Sam's pick", self.gate("lint", "acme").stdout)
        # Sam's favorite, later retracted.
        shutil.rmtree(self.events)
        self.marks(stacks_event(E1, 0, 1000), stacks_event(E2, kind="retract", targets=[E1]))
        self.assertIn("not Sam's pick", self.gate("lint", "acme").stdout)
        # Sam's favorite with a later unrate in the middle of the clip's range.
        shutil.rmtree(self.events)
        self.marks(stacks_event(E1, 0, 1000), stacks_event(E2, 200, 220, kind="unrate"))
        self.assertIn("not Sam's pick", self.gate("lint", "acme").stdout)
        # A favorite that doesn't cover the whole range.
        shutil.rmtree(self.events)
        self.marks(stacks_event(E1, 150, 1000))
        self.assertIn("not Sam's pick", self.gate("lint", "acme").stdout)
        # No Stacks marks reachable at all: refused, never waved through.
        r = self.gate("lint", "acme", STACKS_EVENTS_DIR=os.path.join(self.root, "nowhere"))
        self.assertNotEqual(r.returncode, 0)

    def test_the_mux_asset_must_be_the_contract(self):
        self.write_package(package())
        c = clip()
        for over, words in (({"playback_ids": [{"id": PLAYBACK, "policy": "public"}]}, "signed playback only"),
                            ({"tracks": [{"type": "video"}, {"type": "audio", "max_channels": 2},
                                         {"type": "audio", "max_channels": 1}]}, "exactly one audio track"),
                            ({"tracks": [{"type": "audio", "max_channels": 6}]}, "exactly one audio track"),
                            ({"passthrough": "26-001/x"}, "passthrough must be"),
                            ({"duration": 300.0}, "Mux says the clip is"),
                            ({"status": "preparing"}, "isn't ready")):
            self.mux_assets({ASSET: mux_asset(c, **over)})
            self.assertIn(words, self.gate("lint", "acme").stdout, over)
        self.mux_assets({})
        self.assertIn("can't check the clip on Mux", self.gate("lint", "acme").stdout)

    def test_closed_schema_job_and_file_name(self):
        self.write_package(package(clips=[clip(ai_reason="smiling child")]))
        self.assertIn("unexpected field 'ai_reason'", self.gate("lint", "acme").stdout)
        self.write_package(package(job="26-001"))
        self.assertIn("must equal the project's job_number", self.gate("lint", "acme").stdout)
        os.remove(os.path.join(self.site, "library", "acme", "june-broll.json"))
        self.write_package(package(), name="june-broll (Sam's conflicted copy)")
        self.assertIn("equal its file name", self.gate("lint", "acme").stdout)

    def test_removal_is_immediate_and_leaves_a_tombstone(self):
        two = [clip(), clip(500, 700, ev=E3, mux_asset_id="ASSETid00000000002")]
        self.marks(stacks_event(E3, 450, 800))
        self.mux_assets({ASSET: mux_asset(two[0]), "ASSETid00000000002": mux_asset(two[1])})
        self.write_package(package(clips=two))
        self.assertEqual(self.approve_all().returncode, 0, self.gate("lint", "acme").stdout)
        gone = f"clip:june-broll/{two[1]['key']}"
        r = self.gate("remove", "acme", "--items", gone, "--by", "Sam")
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertEqual([c["key"] for c in self.live_library()["clips"]], [two[0]["key"]])
        self.assertIn("1 previously removed", self.gate("ticket", "acme").stdout)
        r = self.gate("remove", "acme", "--items", "library:june-broll", "--by", "Sam")
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertIsNone(self.live_library())
        self.assertTrue(os.listdir(os.path.join(self.site, "published", "library", "acme", "_removed")))

    def test_a_package_mid_write_neither_changes_nor_disappears(self):
        self.write_package(package())
        self.approve_all()
        open(os.path.join(self.site, "library", "acme", "june-broll.json"), "w").close()  # 0 bytes: online-only/mid-write
        st = self.gate("status", "acme").stdout
        self.assertNotIn("REMOVED", st)
        self.assertNotIn("CHANGED", st)

    def test_at_most_n_clips_per_ticket(self):
        self.write_package(package(clips=[clip(), clip(500, 700, ev=E1)]))
        r = self.gate("approve", "acme", "--by", "Sam", "--ticket", "t1", GATE_MAX_CLIPS_PER_TICKET="1")
        self.assertNotEqual(r.returncode, 0)
        self.assertIn("at most 1", r.stderr + r.stdout)

    def test_preview_shows_pending_footage_to_staff(self):
        self.write_package(package())
        self.gate("preview", "acme")
        path = os.path.join(self.site, "preview", "library", "acme--preview", "june-broll.json")
        with open(path) as f:
            self.assertEqual(json.load(f)["org"], "acme--preview")
        self.approve_all()
        self.assertFalse(os.path.exists(path))


if __name__ == "__main__":
    unittest.main(verbosity=1)
