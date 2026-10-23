# app/staging-gate/ — staging's password page 🤖

Made 10/8/26 by the client-website worker for SPEC §32 (Matters/client-website/SPEC.md).

**What the machine was thinking:** middleware shows this page IN PLACE of any page asked for without a pass (status
200, the address kept), so a tapped link lands where it pointed once the password is in. `page.tsx` is the form (a
read-only username `osc` so Safari and iCloud Keychain save the pair; only the password is checked); `enter/route.ts`
checks it and sets the pass. Both answer 404 on production.

**Rules:** no images or files from `public/` on this page (they sit behind the gate themselves). No rate limiter on
purpose (see the route's header). Never add anything here that reads the database.

**Related:** `lib/staging/gate.ts` (the rules), `middleware.ts` (`stagingGate`). Live status: the client-website
matter's HANDOFF.md.
