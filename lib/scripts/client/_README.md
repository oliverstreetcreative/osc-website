# lib/scripts/client — browser-only script code (client-website matter, SPEC §14) 🤖

Created by the client-website worker, 10/3/26.

**What the machine was thinking:** the browser half of "no lost words": an outbox kept until the server acknowledges
it (and kept on the device), a resend of whatever the server lacks on every reconnect, and suggest mode wired into
TipTap's own dispatch so no edit reaches the document untracked.

- `sync.ts` the live connection (events + updates + presence), save state, refusal handling
- `extensions.ts` TipTap extensions: suggest mode, the node-mark mirror, Tab between boxes, ⌘/Ctrl+Enter for a row

Used by `app/client/scripts/[id]/editor.tsx`. Live status: the matter's HANDOFF.
