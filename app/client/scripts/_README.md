# app/client/scripts — the script editor page (client-website matter, SPEC §14) 🤖

Created by the client-website worker, 10/3/26. `/client/scripts/<id>` sits OUTSIDE the portal's `(app)` shell on
purpose: an invitee lands on the script, not the portal, and OSC staff edit here directly.

- `[id]/page.tsx` access check, names, header · `[id]/editor.tsx` the live editor · `scripts.css` AV layout + marks

Live status: the matter's HANDOFF.
