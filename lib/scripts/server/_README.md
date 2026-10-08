# lib/scripts/server — server-only script code (client-website matter, SPEC §14) 🤖

Created by the client-website worker, 10/3/26. Everything here touches the database or the session, so it never
ships to a browser.

**What the machine was thinking:** keep the live-sync promises in one place — an update is committed (database seq,
per-script lock) before anyone hears about it, and access is decided from the database alone so a long-lived stream
can re-check it.

- `access.ts` who may open a script and as what; Yjs clientIDs bound to one person
- `registry.ts` the live documents in this process, commit/catch-up/snapshot, presence encoding
- `importer.ts` importer output → a script (staff endpoint; staging picks up Dropbox `_admin/client-site/scripts-import/`)

Routes that use these: `app/api/scripts/`. Live status: the matter's HANDOFF.
