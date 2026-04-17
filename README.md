# Oliver Street Creative — Website

Marketing site + customer portals for Oliver Street Creative. This is a single Next.js app that serves four distinct surfaces, switched on the request hostname.

- **Production:** https://oliverstreetcreative.com
- **Staging:** https://staging.oliverstreetcreative.com
- **Repo:** https://github.com/oliverstreetcreative/osc-website
- **Hosting:** Railway (auto-deploys `main`)

## Quick start

```bash
git clone https://github.com/oliverstreetcreative/osc-website.git
cd osc-website
pnpm install                  # postinstall runs `prisma generate`
cp .env.example .env.local    # then fill in (see "Environment variables" below)
pnpm dev                      # http://localhost:3000
```

**Package manager: pnpm** (the lock file is `pnpm-lock.yaml`). Don't introduce `package-lock.json` or `yarn.lock`.

## Architecture

One Next.js 14 (App Router) codebase, four hostnames, routed by `middleware.ts`:

| Hostname | Purpose | Routes served |
|---|---|---|
| `oliverstreetcreative.com` | Public marketing site | `app/page.tsx`, `app/casting`, `app/locations`, `app/join-our-crew`, `app/f/*` (intake forms) |
| `login.oliverstreetcreative.com` | Login + admin | `app/login`, `app/magic`, `app/admin/*` (staff-only) |
| `client.oliverstreetcreative.com` | Client portal | `app/client/*` — middleware rewrites `/<anything>` → `/client/<anything>` |
| `crew.oliverstreetcreative.com` | Crew portal | **Reverse-proxied** to `CREW_PORTAL_URL` via `next.config.mjs` rewrite. No crew code lives in this repo. |

Subdomain routing happens in `middleware.ts` (`getSubdomain()`). On the bare apex domain, anything that isn't an explicit public path or a protected prefix (`/client`, `/crew`, `/admin`, `/api/upload`) falls through to the marketing site.

### Auth

- Session: `osc_session` cookie containing a JWT signed with `SESSION_JWT_SECRET`. Verified with `jose` in middleware.
- Login flow: magic-link via `app/magic` and `app/api/auth/*`.
- Staff impersonation cookie (`osc_impersonating`) exists in newer branches; on `main` today it is just session + role-based gating (`is_staff`, `role === 'STAFF'`).

### The middleware gotcha (read this before adding anything to /public)

The middleware matcher is:

```ts
matcher: ['/((?!_next/static|_next/image|favicon.ico).*)']
```

That means **every request hits `middleware.ts` except** `_next/static/*`, `_next/image/*`, and `favicon.ico`. Files in `/public` are not exempt. If you add a top-level folder under `/public` whose name shares a prefix with a protected route, you must use exact-or-trailing-slash matching (`pathMatches()` in `middleware.ts`), not bare `startsWith()`.

Cautionary tale: `/public/client-logos/*.png` was 307-redirected to `/login` for weeks because `pathname.startsWith('/client')` matches `/client-logos/...`. Fixed by introducing `pathMatches(pathname, '/client')` which requires `pathname === '/client' || pathname.startsWith('/client/')`. If you add `/public/admin-foo/` or `/public/crew-photos/`, the same rule applies — use the helper.

## Tech stack

- **Framework:** Next.js 14.2 (App Router), React 19
- **Styling:** Tailwind CSS v4, shadcn/ui (`components/ui`), Radix primitives
- **Typography:** Inter + EB Garamond
- **Database:** Postgres via Prisma 6.2 (`@prisma/adapter-pg`)
- **Forms:** SurveyJS (`survey-core`, `survey-react-ui`) — see `app/f/[slug]` and `_archive-legacy-forms/` for legacy
- **Uploads:** Uppy (`@uppy/*`) → `app/api/upload`
- **JWT:** `jose`

`next.config.mjs` sets `typescript.ignoreBuildErrors: true` and `images.unoptimized: true`. Type errors will not fail Railway builds — run `pnpm tsc --noEmit` locally if you care.

## Project layout

```
app/
├── page.tsx              # Marketing homepage (root domain)
├── admin/                # Staff admin (login.* subdomain)
├── api/                  # Route handlers
│   ├── auth/             # Magic-link / session (public)
│   ├── intake/           # Form intake (public)
│   ├── publish/          # Bible → Portal sync (public, secret-gated by PUBLISH_SECRET)
│   └── upload/           # Uppy upload target (auth required)
├── casting/              # Public
├── client/               # Client portal (client.* subdomain rewrites here)
├── f/[slug]/             # Public SurveyJS-rendered forms
├── join-our-crew/        # Public
├── locations/            # Public
├── login/                # Login page
└── magic/                # Magic-link landing
components/               # App components + shadcn/ui under components/ui
hooks/                    # React hooks
lib/                      # Server/client helpers (prisma client, dropbox, etc.)
prisma/schema.prisma      # Postgres schema
public/                   # Static assets — see middleware gotcha above
middleware.ts             # Subdomain routing + auth gate
next.config.mjs           # Rewrites (crew portal proxy), image opts
```

## Environment variables

Required for `pnpm dev` to do anything beyond render the marketing homepage:

| Var | Purpose |
|---|---|
| `DATABASE_URL` | Postgres (Railway-managed in prod) |
| `SESSION_JWT_SECRET` | HS256 secret for `osc_session` JWTs |
| `LOGIN_HOST` | Hostname for cross-subdomain login redirects (default `login.oliverstreetcreative.com`) |
| `CREW_PORTAL_URL` | Origin of the separate crew-portal app; if unset, the `/crew/*` rewrite is disabled |
| `PUBLISH_SECRET` | Bearer token for `POST /api/publish` (Bible → Portal sync) |
| `DROPBOX_APP_KEY` / `DROPBOX_APP_SECRET` / `DROPBOX_REFRESH_TOKEN` / `DROPBOX_ACCESS_TOKEN` / `DROPBOX_LOCAL_ROOT` / `DROPBOX_ROOT_PREFIX` | Dropbox integration for asset/upload flows |

Legacy / probably removable: `BASEROW_TOKEN`, `BASEROW_URL` (Baserow was retired April 2026).

There is no `.env.example` checked in yet — when you add new env vars, also add them to `.env.example`.

## Database

Schema: `prisma/schema.prisma`. After changes:

```bash
pnpm prisma generate              # regenerate client (also runs on postinstall)
pnpm prisma migrate dev --name X  # local migration
pnpm prisma studio                # GUI
```

Production migrations are run against Railway's Postgres — coordinate before applying.

## Local subdomain testing

Browsers resolve `*.localhost` to `127.0.0.1` automatically (no `/etc/hosts` edits needed). To test the subdomain branches in `middleware.ts`:

```
http://localhost:3000              # marketing site
http://login.localhost:3000        # login subdomain
http://client.localhost:3000       # client portal (will redirect to /login if no session)
http://crew.localhost:3000         # crew portal (404s unless CREW_PORTAL_URL is set + reachable)
```

## Deployment

- `main` → production (`oliverstreetcreative.com`)
- `staging` branch → `staging.oliverstreetcreative.com`
- Railway watches the repo and auto-builds on push. Build = `next build`. Start = `next start`.
- Roll back: in Railway, redeploy a previous successful build. Or `git revert <sha>` and push.

## Conventions

- Public paths are enumerated in `middleware.ts` (`PUBLIC_PATHS` set + the `isPublicPath()` allowlist). Add new public routes there.
- Protected prefix checks **must** use `pathMatches()` from `middleware.ts`, not bare `startsWith()` — see "middleware gotcha" above.
- shadcn/ui components live under `components/ui/`. Don't edit them by hand; re-add via `npx shadcn@latest add <component>` if you need a tweak.
- Prefer server components; only opt into client (`"use client"`) when you need state, effects, or browser APIs.
