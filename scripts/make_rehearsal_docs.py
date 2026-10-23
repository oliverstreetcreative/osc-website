#!/usr/bin/env python3
"""Make the staging REHEARSAL client's test documents (client-website SPEC §25 v2): a made-up proposal the rehearsal
accepts on staging. Never client material; every page says it's a test.

Run with the tools venv (WeasyPrint):
  /Users/sam/code/oliver-street-skills/.venv-tools/bin/python scripts/make_rehearsal_docs.py \\
    "$HOME/Library/CloudStorage/Dropbox/OLIVER STREET CREATIVE/_admin/client-site/rehearsal/files/rehearsal-osc" \\
    --name "Rehearsal Proposal 1004a.pdf" --total 1000 --good-until 2026-10-31

The gate reads the PDF's text: the total ("$1,000") and the good-until date ("October 31, 2026") must be printed in it.
A fresh file name per rehearsal (an accepted proposal's key and bytes are records; the rehearsal never resets them).
"""
import argparse
import datetime as dt
import os

from weasyprint import HTML

CSS = """
@page { size: letter; margin: 0.9in 0.9in 0.8in;
  @bottom-left { content: "Oliver Street Creative · Cincinnati"; font: 8pt Inter, 'Helvetica Neue', Arial, sans-serif; color: #8a8a84; }
  @bottom-right { content: "REHEARSAL · TEST DOCUMENT · NOT AN OFFER"; font: 700 8pt Inter, 'Helvetica Neue', Arial, sans-serif; color: #e07830; letter-spacing: .08em; } }
body { font: 10.5pt/1.5 'EB Garamond', Georgia, 'Times New Roman', serif; color: #141412; }
.stamp { position: fixed; top: 3.1in; left: 0; right: 0; text-align: center; transform: rotate(-24deg);
  font: 800 80pt Inter, 'Helvetica Neue', Arial, sans-serif; color: rgba(224,120,48,.10); letter-spacing: .12em; }
.mast { display: flex; justify-content: space-between; align-items: baseline; border-bottom: 1.5pt solid #141412; padding-bottom: 8pt; }
.mark { font: 600 13pt 'Barlow Condensed', 'Helvetica Neue', Arial, sans-serif; letter-spacing: .06em; text-transform: uppercase; }
.for { font: 9pt Inter, 'Helvetica Neue', Arial, sans-serif; color: #5a5a55; }
h1 { font: italic 400 24pt 'EB Garamond', Georgia, serif; margin: 22pt 0 2pt; }
.sub { font: 9.5pt Inter, 'Helvetica Neue', Arial, sans-serif; color: #5a5a55; margin: 0 0 16pt; }
h2 { font: 700 8.5pt Inter, 'Helvetica Neue', Arial, sans-serif; text-transform: uppercase; letter-spacing: .1em; color: #8a8a84; margin: 16pt 0 4pt; }
p, li { margin: 0 0 6pt; }
.total { font: 600 14pt Inter, 'Helvetica Neue', Arial, sans-serif; margin-top: 18pt; }
"""


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("out")
    ap.add_argument("--name", required=True)
    ap.add_argument("--total", type=int, required=True)
    ap.add_argument("--good-until", required=True)
    a = ap.parse_args()
    good = dt.date.fromisoformat(a.good_until)
    long_date = f"{good:%B} {good.day}, {good.year}"
    html = f"""<!doctype html><html><head><meta charset="utf-8"><style>{CSS}</style></head><body>
<div class="stamp">REHEARSAL</div>
<div class="mast"><span class="mark">Oliver Street Creative</span><span class="for">For OSC Rehearsal</span></div>
<h1>Rehearsal proposal</h1>
<p class="sub">A test document for proving the client website on staging. Not an offer.</p>
<h2>What we'd make</h2>
<p>One short test film, made up for the rehearsal, so the portal's Accept can be proven end to end.</p>
<h2>Schedule</h2>
<p>None. This is a rehearsal.</p>
<p class="total">Total ${a.total:,}</p>
<p>Good until {long_date}.</p>
</body></html>"""
    os.makedirs(a.out, exist_ok=True)
    path = os.path.join(a.out, a.name)
    HTML(string=html).write_pdf(path)
    print(path)


if __name__ == "__main__":
    main()
