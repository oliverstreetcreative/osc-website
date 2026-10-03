# app/api/scripts — the script store's HTTP surface (client-website matter, SPEC §14) 🤖

Created by the client-website worker, 10/3/26. Signed-in only (middleware answers 401 JSON here, never the login page).

- `[id]/events` GET, Server-Sent Events: sync, update, awareness, left, revoked
- `[id]/updates` POST one Yjs update (suggesters through the guard; 409 = refused, words handed back)
- `[id]/awareness` POST presence (never stored; the server stamps the person's name)
- `import` POST, staff only: importer output → a script

Rules: no route trusts a browser's word for who someone is or what a script says. Live status: the matter's HANDOFF.
