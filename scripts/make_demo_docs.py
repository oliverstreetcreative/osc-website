#!/usr/bin/env python3
"""Make the portal demo's three SAMPLE PDFs (client-website SPEC §19).

Run with the tools venv (WeasyPrint):
  /Users/sam/code/oliver-street-skills/.venv-tools/bin/python scripts/make_demo_docs.py \
    "$HOME/Library/CloudStorage/Dropbox/OLIVER STREET CREATIVE/_admin/client-site/demo/fernwood"
The file names must match lib/client/demo.ts. Fictional client; every page says SAMPLE.
"""
import sys
from weasyprint import HTML

OUT = sys.argv[1] if len(sys.argv) > 1 else "/tmp/cs-demo-docs"

CSS = """
@page { size: letter; margin: 0.9in 0.9in 0.8in;
  @bottom-left { content: "Oliver Street Creative · Cincinnati"; font: 8pt Inter, 'Helvetica Neue', Arial, sans-serif; color: #8a8a84; }
  @bottom-right { content: "SAMPLE DOCUMENT · FOR THE PORTAL DEMO"; font: 700 8pt Inter, 'Helvetica Neue', Arial, sans-serif; color: #e07830; letter-spacing: .08em; } }
body { font: 10.5pt/1.5 'EB Garamond', Georgia, 'Times New Roman', serif; color: #141412; }
.stamp { position: fixed; top: 3.1in; left: 0; right: 0; text-align: center; transform: rotate(-24deg);
  font: 800 92pt Inter, 'Helvetica Neue', Arial, sans-serif; color: rgba(224,120,48,.10); letter-spacing: .12em; }
.mast { display: flex; justify-content: space-between; align-items: baseline; border-bottom: 1.5pt solid #141412; padding-bottom: 8pt; }
.mark { font: 600 13pt 'Barlow Condensed', 'Helvetica Neue', Arial, sans-serif; letter-spacing: .06em; text-transform: uppercase; }
.for { font: 9pt Inter, 'Helvetica Neue', Arial, sans-serif; color: #5a5a55; }
h1 { font: italic 400 24pt 'EB Garamond', Georgia, serif; margin: 22pt 0 2pt; }
.sub { font: 9.5pt Inter, 'Helvetica Neue', Arial, sans-serif; color: #5a5a55; margin: 0 0 16pt; }
h2 { font: 700 8.5pt Inter, 'Helvetica Neue', Arial, sans-serif; text-transform: uppercase; letter-spacing: .1em; color: #8a8a84; margin: 16pt 0 4pt; }
p, li { margin: 0 0 6pt; }
ul { padding-left: 14pt; margin: 0 0 6pt; }
.sig { display: flex; gap: 36pt; margin-top: 26pt; }
.sig div { flex: 1; border-top: 0.75pt solid #141412; padding-top: 4pt; font: 9pt Inter, 'Helvetica Neue', Arial, sans-serif; color: #5a5a55; }
.sig b { display: block; font: italic 15pt 'EB Garamond', Georgia, serif; color: #141412; margin-bottom: 2pt; }
"""

def page(title, sub, body, sig=None):
    sig_html = ""
    if sig:
        sig_html = '<div class="sig">' + "".join(
            f'<div><b>{name}</b>{role}</div>' for name, role in sig) + "</div>"
    return f"""<!doctype html><html><head><meta charset="utf-8"><style>{CSS}</style></head><body>
<div class="stamp">SAMPLE</div>
<div class="mast"><span class="mark">Oliver Street Creative</span><span class="for">for Fernwood Community Foundation (a sample client)</span></div>
<h1>{title}</h1><p class="sub">{sub}</p>{body}{sig_html}</body></html>"""

docs = {
    "Sample Production Agreement - 2025 Year-End Report.pdf": page(
        "Production Agreement",
        "2025 Year-End Report · a sample agreement for the portal demo",
        """<h2>What we're making</h2>
<p>One year-end report film, about four minutes, plus a :30 cutdown for social. Interviews with two board members and
three families the Foundation served this year, with b-roll of the programs in action.</p>
<h2>How it runs</h2>
<ul><li>One interview day and one b-roll day, scheduled together.</li>
<li>Two rounds of notes on the cut. Notes come through the client portal, one consolidated list per round.</li>
<li>A pickup interview if the board chair can't make the first day.</li></ul>
<h2>What you get</h2>
<ul><li>Final films in web (H.264) and broadcast (ProRes) versions, plus captions.</li>
<li>Everything you sign, and every file you need, kept in your portal.</li></ul>
<h2>Payment</h2>
<p>Half to book the dates, half when the second cut is ready.</p>""",
        sig=[("Dana Whitfield", "Fernwood Community Foundation · sample signer"),
             ("Sam Patton", "Oliver Street Creative")]),
    "Sample Proposal - 2025 Year-End Report.pdf": page(
        "Proposal",
        "2025 Year-End Report · a sample proposal for the portal demo",
        """<h2>The idea</h2>
<p>Your year in the words of the people who lived it. Instead of a slideshow of numbers, three families tell us what
changed for them, and two board members tell us why the Foundation keeps showing up.</p>
<h2>The plan</h2>
<ul><li>Pre-production call to pick the stories.</li>
<li>Interview day at the community center; b-roll the same week.</li>
<li>First cut two weeks after filming; second cut a week after your notes.</li></ul>
<h2>Why us</h2>
<p>We make story films for organizations like yours: the kind people remember after the event.</p>"""),
    "Sample Location Release - Fernwood Community Center.pdf": page(
        "Location Release",
        "Fernwood Community Center · a sample release for the portal demo",
        """<p>The undersigned, authorized to grant access to the location named above, gives Oliver Street Creative
permission to film there on the agreed dates and to use the footage in the films made for Fernwood Community
Foundation.</p>
<p>Oliver Street Creative will leave the location as it found it and will be covered by its own production
insurance while on site.</p>""",
        sig=[("Dana Whitfield", "Fernwood Community Foundation · sample signer")]),
}

import os
os.makedirs(OUT, exist_ok=True)
for name, html in docs.items():
    HTML(string=html).write_pdf(os.path.join(OUT, name))
    print("wrote", name)
