// Deputies (client-website SPEC §27 P1 v2 #8; Sam's 10/4 ask for Sign Here): who may send and manage agreements for
// Sam, where, until when. The OWNER's page alone: deputies never see it (404). Managing it needs a sign-in that
// proved the mailbox in the last 10 minutes; anything older asks to sign in again. Each change emails Sam and raises
// a flag for Majordomo. Revoking also signs the deputy out of Sign Here (from P1b; until then Sign Here re-checks on
// every admin action, so a revoked grant stops working there at once).
import { notFound, redirect } from "next/navigation"
import { db } from "@/lib/db"
import { sessionUser } from "@/lib/auth/require-session"
import { ownerEmail } from "@/lib/idp/subjects"
import { GRANT_ERRORS, GRANT_MAX_DAYS, normEmail, stepUpFresh, type GrantError } from "@/lib/idp/rules"
import { SectionTitle, Wordmark } from "@/app/client/ui"

export const metadata = { title: "Deputies", robots: { index: false, follow: false } }
export const dynamic = "force-dynamic"

const day = (d: Date) => d.toLocaleDateString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", year: "numeric" })
const iso = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: "America/New_York" })
const scopeWords = (scope: unknown) =>
  scope === "all" ? "All jobs" : Array.isArray(scope) && scope.length ? `Jobs ${(scope as string[]).join(", ")}` : "No jobs"

export default async function Deputies({ searchParams }: { searchParams: { done?: string; error?: string } }) {
  const s = await sessionUser()
  if (!s || s.scope || s.kind !== "person") redirect(`/login?redirect=${encodeURIComponent("/id/deputies")}`)
  const owner = ownerEmail()
  if (!owner || normEmail(s.person.email) !== owner) notFound()
  const now = new Date()

  if (!stepUpFresh({ created_at: s.createdAt, amr: s.amr }, now)) {
    return (
      <div className="sc-page">
        <header className="cs-top">
          <div className="cs-top-in">
            <a href="/client" aria-label="Oliver Street Creative"><Wordmark /></a>
          </div>
        </header>
        <main className="cs-main">
          <h1 className="cs-title">Deputies</h1>
          <div className="cs-card cs-pad" style={{ marginTop: 16 }}>
            <p>For your safety, changing who can act for you needs a fresh sign-in: the last 10 minutes.</p>
            <p style={{ marginTop: 12 }}>
              <a className="cs-btn" href={`/login?redirect=${encodeURIComponent("/id/deputies")}`}>Sign in again</a>
            </p>
          </div>
        </main>
      </div>
    )
  }

  const grants = await db.deputyGrant.findMany({ orderBy: [{ granted_at: "desc" }], take: 60 })
  const live = grants.filter((g) => !g.revoked_at && g.until > now)
  const past = grants.filter((g) => !live.includes(g)).slice(0, 20)
  const err = searchParams.error && searchParams.error in GRANT_ERRORS ? GRANT_ERRORS[searchParams.error as GrantError] : null
  const done = searchParams.done === "granted" ? "Done: they're a deputy now. You'll get an email about it." : searchParams.done === "revoked" ? "Revoked. You'll get an email about it." : null
  const maxDay = iso(new Date(now.getTime() + GRANT_MAX_DAYS * 86400_000))

  return (
    <div className="sc-page">
      <header className="cs-top">
        <div className="cs-top-in">
          <a href="/client" aria-label="Oliver Street Creative"><Wordmark /></a>
        </div>
      </header>
      <main className="cs-main">
        <h1 className="cs-title">Deputies</h1>
        <p className="cs-lede">Who can send and manage agreements in Sign Here for you, and until when. Each change emails you.</p>
        {done ? <div className="cs-card cs-pad" role="status" style={{ marginTop: 14 }}><p>{done}</p></div> : null}
        {err ? <p className="cs-form-error" role="alert" style={{ marginTop: 14 }}>{err}</p> : null}

        <section className="cs-section">
          <SectionTitle>Now</SectionTitle>
          {live.length ? (
            <div className="cs-rows">
              {live.map((g) => (
                <div key={g.id} className="cs-row" style={{ alignItems: "center" }}>
                  <span className="cs-row-main">
                    <strong>{g.email}</strong>
                    <small>
                      {scopeWords(g.scope)} · until {day(g.until)}
                      {g.reason ? ` · ${g.reason}` : ""}
                    </small>
                  </span>
                  <form action="/id/deputies/revoke" method="post">
                    <input type="hidden" name="id" value={g.id} />
                    <button className="cs-btn ghost sm">Revoke</button>
                  </form>
                </div>
              ))}
            </div>
          ) : (
            <div className="cs-card cs-pad"><p>No one can act for you right now.</p></div>
          )}
        </section>

        <section className="cs-section">
          <SectionTitle>Make someone a deputy</SectionTitle>
          <form action="/id/deputies/grant" method="post" className="cs-card cs-pad" style={{ display: "grid", gap: 10 }}>
            <label className="cs-field">
              <span>Their email</span>
              <input name="email" type="email" required autoComplete="off" placeholder="kris@example.com" className="cs-date-input cs-wide" />
            </label>
            <label className="cs-field">
              <span>Which jobs</span>
              <input name="scope" type="text" placeholder="all, or 26-012, 26-033" defaultValue="all" className="cs-date-input cs-wide" />
            </label>
            <label className="cs-field">
              <span>Last day</span>
              <input name="until" type="date" required min={iso(now)} max={maxDay} className="cs-date-input" />
            </label>
            <label className="cs-field">
              <span>Why (optional; only you see it)</span>
              <input name="reason" type="text" maxLength={200} className="cs-date-input cs-wide" />
            </label>
            <p style={{ fontSize: 13 }}>They sign in with their own email. They can send and manage agreements on those jobs until the last day, and never make deputies themselves.</p>
            <button className="cs-btn">Make deputy</button>
          </form>
        </section>

        {past.length ? (
          <section className="cs-section">
            <SectionTitle>Earlier</SectionTitle>
            <div className="cs-rows">
              {past.map((g) => (
                <div key={g.id} className="cs-row">
                  <span className="cs-row-main">
                    <strong>{g.email}</strong>
                    <small>
                      {scopeWords(g.scope)} · {g.revoked_at ? `revoked ${day(g.revoked_at)}` : `ended ${day(g.until)}`}
                    </small>
                  </span>
                </div>
              ))}
            </div>
          </section>
        ) : null}
      </main>
    </div>
  )
}
