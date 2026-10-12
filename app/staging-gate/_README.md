# Staging access by OSC email

Sam 10/11 23:20: replace the password with magic-link access for any exact
@oliverstreetcreative.com address, including addresses absent from the portal.

The gate grants staging access only. It never creates a Person, staff role,
portal session or client membership. Existing portal auth remains separate.
Existing mail transport, device cookies, hashed counting and bounded Postgres
rate limits are reused. No mail is sent by tests.

Native POST /enter requests a 15-minute token and six-digit code. Only hashes
are stored in staging_access_links. GET /magic is passive; POST /verify checks
the requesting device and consumes atomically. On another device, POST /code
has five tries and uses the existing address/network failure limits. Expired,
spent, cross-host and non-OSC records fail closed. POST /signout clears access.

Passes are v2, signed for this purpose using SESSION_JWT_SECRET (at least 32
characters after trimming outer whitespace); no STAGING_PASSWORD is used. Old v1 passes expire
immediately on rollout. All gate endpoints 404 off staging. A missing key closes
staging rather than opening it.

HTTPS cookies are HttpOnly/Secure/SameSite=Lax for 30 days. Only the staging
hostname family shares .staging.oliverstreetcreative.com; Railway uses a
host-only __Host- cookie. Production parent domains never receive this grant.
The preview harness still has its separate protected entrance and no Comment UI.

Deploy prerequisites: additive staging_access_links table (Prisma staging boot,
or prisma/staging-access-links.sql if schema push is disabled), existing staging
DB/signing/mail setup. No production schema/data change is needed for the gate.
Pure/injected tests do not contact a DB or delivery provider. A staging-only
delivery/DB/browser smoke test remains a deployer check, not a worker action.
