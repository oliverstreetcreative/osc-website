# Staging gate

Sam 10/11 23:20 replaces STAGING_PASSWORD with proof of an exact OSC email address.
gate.ts is Edge-safe: v2 purpose-bound signed passes, strict cookie scopes, safe
redirects and exact method/path exemptions. Middleware invokes it before routing.
The existing protected preview/demo/calendar/script entrances retain their
independent authorization.

magic.ts is server-side pure logic with injected storage, limits and delivery.
magic-server.ts adapts the committed staging_access_links model and reuses
auth/door.ts's database-backed limits, device cookie and existing email sender.
Unknown OSC addresses need no Person row; gate access adds no portal privileges.

Tests use fake storage and email delivery. Expiry, replay/races, device/code
fallback, malformed input, code limits, external redirects, production-off and
domain/cookie boundaries are tested without network, database or real secrets.
See app/staging-gate/_README.md for deployment prerequisites and endpoint flow.
