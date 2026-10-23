// Your devices (SPEC §27 P0 v2): every place this person is signed in, with "Sign out" on each and "Sign out
// everywhere". Outside the client shell, so staff, people who only have scripts, and a script invite's session all
// reach it. A script, preview or demo session sees only itself (a forwarded invite never shows the person's devices).
import { redirect } from "next/navigation"
import { db } from "@/lib/db"
import { sessionUser } from "@/lib/auth/require-session"
import { Wordmark } from "@/app/client/ui"

export const metadata = { title: "Your devices" }
export const dynamic = "force-dynamic"

const lastUsed = (d: Date | null) => {
  if (!d) return "not used yet"
  const days = Math.floor((Date.now() - d.getTime()) / 86400_000)
  if (days <= 0) return "used today"
  if (days === 1) return "used yesterday"
  if (days < 30) return `used ${days} days ago`
  return `last used ${d.toLocaleDateString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric" })}`
}

export default async function Devices() {
  const s = await sessionUser()
  if (!s) redirect("/login?redirect=/client/account")
  const full = s.kind === "person" && !s.scope
  const rows = full
    ? await db.portalSession.findMany({
        where: { person_id: s.person.id, revoked_at: null, expires_at: { gt: new Date() }, kind: { in: ["person", "script"] } },
        orderBy: [{ last_active_at: "desc" }],
        select: { id: true, device_label: true, last_active_at: true, kind: true, created_at: true },
        take: 30,
      })
    : await db.portalSession.findMany({ where: { id: s.sid }, select: { id: true, device_label: true, last_active_at: true, kind: true, created_at: true } })
  return (
    <div className="sc-page">
      <header className="cs-top">
        <div className="cs-top-in">
          <a href={s.scope ? `/client/scripts/${s.scope.id}` : "/client"} aria-label="Oliver Street Creative">
            <Wordmark />
          </a>
        </div>
      </header>
      <main className="cs-main">
        <h1 className="cs-title">Your devices</h1>
        <p className="cs-lede">
          {full ? `Where ${s.person.first_name ?? s.person.name.split(" ")[0]} is signed in.` : "This sign-in only."} Signing a device out ends
          it there right away.
        </p>
        <div className="cs-rows" style={{ marginTop: 16 }}>
          {rows.map((r) => (
            <div key={r.id} className="cs-row" style={{ alignItems: "center" }}>
              <span className="cs-row-main">
                <strong>{r.device_label ?? "A device"}{r.id === s.sid ? " · this device" : ""}</strong>
                <small>
                  {lastUsed(r.last_active_at)}
                  {r.kind === "script" ? " · one script only" : ""}
                </small>
              </span>
              <form action="/client/account/revoke" method="post">
                <input type="hidden" name="sid" value={r.id} />
                <button className="cs-btn ghost sm">Sign out</button>
              </form>
            </div>
          ))}
        </div>
        {full ? (
          <>
            <form action="/client/account/revoke" method="post" style={{ marginTop: 18 }}>
              <input type="hidden" name="all" value="1" />
              <button className="cs-btn">Sign out everywhere</button>
            </form>
            <p className="cs-lede" style={{ marginTop: 18, fontSize: 13 }}>
              Your private calendar link keeps working after you sign out. If you think it got out, reset it on the{" "}
              <a href="/client/calendar">Calendar page</a>.
            </p>
          </>
        ) : null}
      </main>
    </div>
  )
}
