#!/usr/bin/env python3
"""Tests for the timing reference (scripts/script_timing.py) and the vector file the TypeScript module must match.

Run: python3 scripts/test_script_timing.py            (tests)
     python3 scripts/test_script_timing.py --vectors  (rewrite lib/scripts/timing.vectors.json, then run the tests)
"""
import json
import os
import sys
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import script_timing as st  # noqa: E402
import import_script as imp  # noqa: E402

VECTORS = HERE.parent / "lib" / "scripts" / "timing.vectors.json"
TORRES = Path(os.path.expanduser("~/Library/CloudStorage/Dropbox/OLIVER STREET CREATIVE/Clients/Torres"))
HARMON = TORRES / "torres_mike-harmon-sos_26-037/scripts/Harmon script as texted 2026-10-02 0655 (CURRENT).txt"
GEX = TORRES / "torres_gex-williams_26-033/scripts/source/2026-08-28_williams-scripts_canonical-snapshot.md"

# Hand-checked: (text, words, pauses_s, blanks). Each line was counted by a person, not by the code.
TEXT_CASES = [
    ("Hi. I’m Mike Harmon and I am running for Secretary of State of the Commonwealth of Kentucky.", 17, 0, 0),
    ("$29M", 4, 0, 0),                                   # twenty nine million dollars
    ("in 2026", 4, 0, 0),                                # in twenty twenty six
    ("at 3:15", 3, 0, 0),                                # at three fifteen
    ("3:00", 2, 0, 0),                                   # three o'clock
    ("3:05", 3, 0, 0),                                   # three oh five
    ("10–15 minutes", 4, 0, 0),                          # ten to fifteen minutes
    ("Pro 2nd Amendment", 3, 0, 0),
    ("the 20th district", 3, 0, 0),
    ("the 21st century", 4, 0, 0),                       # the twenty first century
    ("please head to Gexforsenate.com", 8, 0, 0),        # please head to + gex for senate dot com
    ("I secured more than $___ million for our district—real investments", 12, 0, 1),
    ("I also secured over $___million for road improvements", 10, 0, 1),  # 4 + "$___million" 3 + 3
    ("My name is Maria Rodriguez… and I'm running", 8, 0.5, 0),
    ("**SFX:** Music resolves. **SUPER:** Paid for by Maria Rodriguez for Congress.", 0, 0, 0),
    ("**Maria (O/C):** I wasn't born into freedom… I ran to it.", 9, 0.5, 0),
    ("Call (859) 512-1419 today", 12, 0, 0),             # call + ten digits + today
    ("(beat) Thank you.", 2, 1.0, 0),
    ("(pause) Thank you.", 2, 1.5, 0),
    ("(Close up) My husband", 2, 0, 0),                  # a direction is never read
    ("[Cut to road crews] Fixing roads", 2, 0, 0),
    ("Remember: vote", 2, 0, 0),                         # ordinary copy, not a label
    ("NARRATOR: To learn more", 3, 0, 0),                # a label is not read
    ("re-election", 1, 0, 0),
    ("50% of families", 4, 0, 0),                        # fifty percent of families
    ("1,200 kids", 5, 0, 0),                             # one thousand two hundred kids
    ("2.5 million", 4, 0, 0),                            # two point five million
    ("November third!.", 2, 0, 0),
    ("in 1999", 4, 0, 0),                                # in nineteen ninety nine
    ("in 2005", 4, 0, 0),                                # in two thousand five
]

ROW_CASES = [
    # (rows, wpm, expected total seconds, untimed rows)
    ([{"audio": [{"text": "one two three four five"}]}], 150, 2.0, 0),
    ([{"audio": [{"text": "one two three four five"}], "hold_s": 3}], 150, 3.0, 0),   # the hold wins
    ([{"video": ["End card"], "audio": [], "hold_s": 3}], 150, 3.0, 0),
    ([{"video": ["End card"], "audio": []}], 150, 0.0, 1),                            # no time set
    ([{"audio": [{"text": "(beat)"}]}], 150, 1.0, 0),
    ([{"audio": [{"text": "one two three four five six seven eight nine ten eleven"}]}], 165, 4.0, 0),
]

LABEL_CASES = [
    # (total_s, target_s, blanks, label)
    (28.2, 30, 0, "0:28 of :30"),
    (34.4, 30, 0, "0:34 of :30 · 4 s over"),
    (56.8, None, 0, "0:57 · no target set"),
    (52.0, 60, 2, "about 0:52 of 1:00 · 2 blanks"),
    (30.4, 30, 0, "0:30 of :30"),
    (61.0, 60, 1, "about 1:01 of 1:00 · 1 s over · 1 blank"),
]


def real_scripts():
    out = []
    if HARMON.exists():
        out.append(("harmon", imp.harmon_texted(HARMON, "Harmon SoS")["rows"]))
    if GEX.exists():
        for spot in ("Family", "Waste", "Appropriation"):
            out.append((f"gex-{spot.lower()}", imp.gex_snapshot(GEX, spot, spot)["rows"]))
    return out


class Text(unittest.TestCase):
    def test_hand_checked_lines(self):
        for text, words, pauses, blanks in TEXT_CASES:
            with self.subTest(text=text):
                got = st.time_text(text)
                self.assertEqual((got["words"], got["pauses_s"], got["blanks"]), (words, pauses, blanks))


class Rows(unittest.TestCase):
    def test_rows(self):
        for rows, wpm, total, untimed in ROW_CASES:
            with self.subTest(rows=rows):
                got = st.time_rows(rows, wpm)
                self.assertAlmostEqual(got["total_s"], total, places=3)
                self.assertEqual(got["untimed_rows"], untimed)

    def test_labels(self):
        for total, target, blanks, want in LABEL_CASES:
            with self.subTest(total=total, target=target):
                self.assertEqual(st.label(total, target, blanks), want)


@unittest.skipUnless(HARMON.exists(), "Torres Dropbox folder not on this machine")
class RealScripts(unittest.TestCase):
    def test_harmon_is_a_sixty(self):
        res = st.time_rows(imp.harmon_texted(HARMON, "Harmon SoS")["rows"])
        self.assertEqual(res["words"], 142)  # Mike's six paragraphs; his delivery note and the end card aren't read
        self.assertEqual(res["untimed_rows"], 1)  # the end card has no hold yet
        self.assertEqual(st.label(res["total_s"], None), "0:57 · no target set")

    def test_gex_spots_have_their_blanks_flagged(self):
        res = st.time_rows(imp.gex_snapshot(GEX, "Appropriation", "Appropriation")["rows"])
        self.assertEqual(res["blanks"], 3)


class VectorFile(unittest.TestCase):
    def test_vectors_match_the_reference(self):
        """The file the TypeScript module is tested against must agree with this reference, case by case."""
        self.assertTrue(VECTORS.exists(), f"{VECTORS} missing: run with --vectors")
        v = json.loads(VECTORS.read_text(encoding="utf-8"))
        for c in v["text"]:
            got = st.time_text(c["text"])
            self.assertEqual((got["words"], got["pauses_s"], got["blanks"]), (c["words"], c["pauses_s"], c["blanks"]), c["text"])
        for c in v["rows"]:
            self.assertAlmostEqual(st.time_rows(c["rows"], c["wpm"])["total_s"], c["total_s"], places=3)
        for c in v["labels"]:
            self.assertEqual(st.label(c["total_s"], c["target_s"], c["blanks"]), c["label"])


def write_vectors():
    data = {
        "about": "Timing test vectors (client-website SPEC §14). lib/scripts/timing.ts must reproduce every case. "
                 "Made by scripts/test_script_timing.py --vectors from hand-checked cases and the real scripts.",
        "default_wpm": st.DEFAULT_WPM,
        "text": [{"text": t, **st.time_text(t)} for t, *_ in TEXT_CASES],
        "rows": [{"rows": r, "wpm": w, "total_s": st.time_rows(r, w)["total_s"]} for r, w, *_ in ROW_CASES]
        + [{"name": name, "rows": rows, "wpm": st.DEFAULT_WPM, "total_s": st.time_rows(rows)["total_s"],
            "words": st.time_rows(rows)["words"], "blanks": st.time_rows(rows)["blanks"]} for name, rows in real_scripts()],
        "labels": [{"total_s": t, "target_s": g, "blanks": b, "label": l} for t, g, b, l in LABEL_CASES],
    }
    VECTORS.parent.mkdir(parents=True, exist_ok=True)
    VECTORS.write_text(json.dumps(data, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"wrote {VECTORS}")


if __name__ == "__main__":
    if "--vectors" in sys.argv:
        sys.argv.remove("--vectors")
        write_vectors()
    unittest.main(verbosity=1)
