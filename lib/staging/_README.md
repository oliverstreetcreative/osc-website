# lib/staging/ — staging is Sam's 🤖

Made 10/8/26 by the client-website worker for SPEC §32 (Matters/client-website/SPEC.md): Sam's rule that everything
built for the new website goes to staging automatically, that he can "just browse it and comment", and that staging
can be password protected.

**What the machine was thinking:** two small things that only ever run on staging, kept apart from the client site's
own code so production can't reach them by accident. Pure modules (no database, no Next imports) so the same code runs
in middleware (Edge), in the Node routes and in the plain `node --test` runs.

- `gate.ts` — the password gate: the pass cookie (`v1.<exp>.<HMAC>`), the exact list of requests that never need it,
  `next` checking. Middleware calls it FIRST on staging; it fails closed (503) without a usable `STAGING_PASSWORD`.
- `comment.ts` — what a Comment-button note may hold (cleaned, secrets scrubbed) and where it's filed in Dropbox.

**Rules:** nothing here may run on production (every caller checks `IS_STAGING` first). The pass format is pinned by a
test because the drivers compute the same bytes. The owners table (which matter a page belongs to) lives in
`scripts/route_staging_comments.py`, not here. Tests sit beside the code (`*.test.ts`).

**Related:** `app/staging-gate/` (the page and its form), `app/api/staging/comment/` (the note's endpoint),
`app/staging-comment.tsx` (the button), `scripts/route_staging_comments.py` (notes → PENDING-RULINGS),
`scripts/set_staging_password.py` (the secret). Live status: the client-website matter's HANDOFF.md.
