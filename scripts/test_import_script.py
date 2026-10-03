#!/usr/bin/env python3
"""Tests for scripts/import_script.py against the REAL canonical scripts (read-only), plus synthetic edge cases.

The promise under test (SPEC §14 v4 decision 4): the import keeps the client's exact words, and accepting every
suggestion reproduces the PROMPTER file Sam reads from, byte for byte (modulo trailing spaces).
Real-file tests skip when the Dropbox folder isn't on this machine.
"""
import json
import os
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import import_script as imp  # noqa: E402

TORRES = Path(os.path.expanduser("~/Library/CloudStorage/Dropbox/OLIVER STREET CREATIVE/Clients/Torres"))
HARMON = TORRES / "torres_mike-harmon-sos_26-037/scripts"
GEX = TORRES / "torres_gex-williams_26-033/scripts"
HARMON_CANON = HARMON / "Harmon script as texted 2026-10-02 0655 (CURRENT).txt"
HARMON_PROMPTER = HARMON / "PROMPTER_Harmon_v3_FULL-READ_2026-10-02.txt"
GEX_CANON = GEX / "source/2026-08-28_williams-scripts_canonical-snapshot.md"


def norm(text: str) -> str:
    """Compare files the way the importer reads them: paragraphs, trailing spaces dropped."""
    return "\n\n".join(imp._paragraphs(text)) + "\n"


@unittest.skipUnless(HARMON_CANON.exists(), "Torres Dropbox folder not on this machine")
class Harmon(unittest.TestCase):
    def setUp(self):
        self.doc = imp.add_prompter_suggestions(imp.harmon_texted(HARMON_CANON, "Harmon SoS"), HARMON_PROMPTER,
                                                "Sam (prompter fix)", "from PROMPTER v3")

    def test_rows_keep_mikes_words(self):
        rows = self.doc["rows"]
        self.assertEqual(len(rows), 7)
        self.assertTrue(rows[0]["audio"][0]["text"].startswith("Hi. Im Mike Harmon"))  # his typo, kept
        self.assertEqual(rows[2]["directions"], ["heightened speed on delivery but slow down for next line"])
        self.assertNotIn("heightened", rows[2]["audio"][0]["text"])
        self.assertEqual(rows[6], {"video": ["Logo fade in. Paid for by Mike Harmon."], "audio": [], "directions": [],
                                   "source": "Logo fade in. Paid for by Mike Harmon."})
        for r in rows:
            for a in r["audio"]:
                self.assertIsNone(a["speaker"])  # the texted script names no speaker; never invent one
                self.assertIn(a["text"], r["source"])  # every word comes from the source paragraph

    def test_message_around_the_script_is_dropped_and_recorded(self):
        self.assertEqual([d["text"] for d in self.doc["dropped"]],
                         ["I made the other change and deleted some duplication", "Script:"])

    def test_the_one_fix_is_a_suggestion(self):
        s = self.doc["suggestions"]
        self.assertEqual(len(s), 1)
        self.assertEqual((s[0]["row"], s[0]["field"], s[0]["replace"]), (0, "audio", "I’m"))
        self.assertEqual(self.doc["rows"][0]["audio"][0]["text"][s[0]["start"]:s[0]["end"]], "Im")

    def test_accepting_everything_reproduces_the_prompter(self):
        rows = imp.apply_suggestions(self.doc)
        self.assertEqual(imp.prompter_text(rows), norm(HARMON_PROMPTER.read_text(encoding="utf-8")))


@unittest.skipUnless(GEX_CANON.exists(), "Torres Dropbox folder not on this machine")
class Gex(unittest.TestCase):
    def doc(self, spot):
        return imp.add_prompter_suggestions(imp.gex_snapshot(GEX_CANON, spot, spot), GEX / f"teleprompter/{spot}_PROMPTER.txt",
                                            "Sam (prompter fix)", f"from {spot}_PROMPTER.txt")

    def test_every_spot_round_trips_to_its_prompter(self):
        for spot in ("Family", "Waste", "Appropriation"):
            with self.subTest(spot=spot):
                d = self.doc(spot)
                want = norm((GEX / f"teleprompter/{spot}_PROMPTER.txt").read_text(encoding="utf-8"))
                self.assertEqual(imp.prompter_text(imp.apply_suggestions(d)), want)

    def test_family_rows(self):
        rows = self.doc("Family")["rows"]
        self.assertEqual([r["video"] for r in rows], [["Close up"], ["Family Photos"], ["Frankfort photo"], [], []])
        self.assertEqual([r["audio"][0]["speaker"] for r in rows], ["Judy", "Judy", "Judy", "Judy", "NARRATOR"])
        self.assertTrue(rows[3]["audio"][0]["text"].endswith("November third!."))  # the typo stays in the source

    def test_family_fixes_are_suggestions(self):
        d = self.doc("Family")
        got = sorted((s["row"], s["field"], s["start"], s["end"], s["replace"]) for s in d["suggestions"])
        # "third!." → "third!" replaces the word; the label gains " (VO)" as a pure insertion after "NARRATOR".
        text = d["rows"][3]["audio"][0]["text"]
        at = text.index("third!.")
        self.assertEqual(got, [(3, "audio", at, at + len("third!."), "third!"), (4, "speaker", 8, 8, " (VO)")])

    def test_appropriation_cues_and_blanks(self):
        d = self.doc("Appropriation")
        rows = d["rows"]
        self.assertEqual(len(rows), 7)
        self.assertEqual(rows[3]["video"], ["Cut to road crews / driving shots"])
        self.assertEqual(rows[4]["video"], ["Cut back to Gex, direct-to-camera"])
        self.assertIn("Singer Brige", rows[2]["audio"][0]["text"])  # Sebastian's typo, kept
        self.assertIn("$___million", rows[3]["audio"][0]["text"])  # his blank, exactly as written
        fixes = sorted(s["replace"] for s in d["suggestions"])
        self.assertEqual(fixes, ["$___ million", "Bridge—repairing"])

    def test_waste_fix(self):
        d = self.doc("Waste")
        self.assertEqual([(s["row"], s["replace"]) for s in d["suggestions"]], [(3, "work's")])
        self.assertTrue(all(r["audio"][0]["speaker"] is None for r in d["rows"]))

    def test_snapshot_header_never_imported(self):
        d = self.doc("Waste")
        self.assertNotIn("SNAPSHOT", json.dumps(d["rows"]))
        self.assertIn("SNAPSHOT", d["dropped"][0]["text"])


class Refusals(unittest.TestCase):
    def write(self, text):
        f = tempfile.NamedTemporaryFile("w", suffix=".txt", delete=False, encoding="utf-8")
        f.write(text)
        f.close()
        self.addCleanup(os.unlink, f.name)
        return Path(f.name)

    def test_harmon_without_script_label(self):
        with self.assertRaises(imp.ImportRefused):
            imp.harmon_texted(self.write("Hi there.\n\nMore words.\n"), "x")

    def test_gex_missing_spot(self):
        p = self.write("header\n---\n\n# Script: A\n\nWords.\n")
        with self.assertRaises(imp.ImportRefused):
            imp.gex_snapshot(p, "B", "B")

    def test_gex_dangling_cue(self):
        p = self.write("header\n---\n\n# Script: A\n\nWords.\n\n[Cut to black]\n")
        with self.assertRaises(imp.ImportRefused):
            imp.gex_snapshot(p, "A", "A")

    def test_prompter_with_a_different_shape(self):
        d = imp.harmon_texted(self.write("Script:\n\nOne.\n\nTwo.\n"), "x")
        with self.assertRaises(imp.ImportRefused):
            imp.add_prompter_suggestions(d, self.write("One.\n"), "Sam", "n")

    def test_only_trailing_spaces_are_normalised(self):
        d = imp.harmon_texted(self.write("Script:\n\n  Two  spaces inside.   \n"), "x")
        self.assertEqual(d["rows"][0]["audio"][0]["text"], "  Two  spaces inside.")


if __name__ == "__main__":
    unittest.main(verbosity=1)
