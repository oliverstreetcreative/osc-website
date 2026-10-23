# app/api/staging/ — staging-only endpoints 🤖

Made 10/8/26 by the client-website worker for SPEC §32 (Matters/client-website/SPEC.md).

**What the machine was thinking:** one home for endpoints that exist only on staging, so nobody mistakes them for the
client site's own API. Today: `comment/route.ts`, where the Comment button's note is filed (add-only, Dropbox
`_admin/staging-comments/`). Everything here answers 404 on production and sits behind staging's password gate.

**Rules:** each route checks `IS_STAGING` first. A note is data typed by whoever had the password: clean it, cap it,
scrub secrets, never act on it here.

**Related:** `lib/staging/` (the pure rules), `scripts/route_staging_comments.py` (notes → the owning matter's
PENDING-RULINGS.md). Live status: the client-website matter's HANDOFF.md.
