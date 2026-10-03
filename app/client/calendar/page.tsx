import { randomBytes } from "crypto"
import { CalendarDays, RefreshCw } from "lucide-react"
import { requireClientContext } from "@/lib/client/context"
import { db } from "@/lib/db"
import { eventsForPerson } from "@/lib/client/calendar"
import { day, todayUTC } from "@/lib/client/format"
import { pageOrigin } from "@/lib/client/host"
import { HelpFooter, SectionTitle } from "../ui"

export const metadata = { title: "Calendar" }

export default async function CalendarPage() {
  const ctx = await requireClientContext()
  let person = await db.person.findUnique({ where: { id: ctx.user.id } })
  if (person && !person.calendar_token) {
    person = await db.person.update({ where: { id: person.id }, data: { calendar_token: randomBytes(24).toString("base64url") } })
  }
  const origin = await pageOrigin()
  const host = origin.replace(/^https?:\/\//, "")
  const webcal = `webcal://${host}/calendar/${person!.calendar_token}.ics`
  const https = `${origin}/calendar/${person!.calendar_token}.ics`
  const google = `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(webcal)}`
  const upcoming = (await eventsForPerson(ctx.user.id, ctx.user.is_staff)).filter((e) => e.date >= todayUTC()).slice(0, 8)

  return (
    <main className="cs-main">
      <p className="cs-eyebrow">Your calendar</p>
      <h1 className="cs-title" style={{ marginTop: 6 }}>Every date, in your calendar</h1>
      <p className="cs-lede">Subscribe once. Filming days, call times and due dates show up in your own calendar, and change there when they change here. Each one links back to this site.</p>

      <section className="cs-section" style={{ marginTop: 22 }}>
        <div className="cs-card cs-pad" style={{ display: "grid", gap: 10 }}>
          <a className="cs-btn" href={webcal}><CalendarDays /> Subscribe (Apple or Outlook)</a>
          <a className="cs-btn ghost" href={google} target="_blank" rel="noopener">Subscribe in Google Calendar</a>
          <p className="cs-lede" style={{ fontSize: 13, wordBreak: "break-all" }}>
            Or paste this private link into any calendar app: <span style={{ color: "var(--text)" }}>{https}</span>
          </p>
        </div>
      </section>

      <section className="cs-section">
        <SectionTitle>Coming up</SectionTitle>
        {upcoming.length ? (
          <div className="cs-rows">
            {upcoming.map((e) => (
              <a key={e.uid} className="cs-row" href={e.path}>
                <span className="cs-ico"><CalendarDays /></span>
                <span className="cs-row-main"><strong>{e.title}</strong><small>{day(e.date, { weekday: "short", month: "short", day: "numeric" })}{e.location ? ` · ${e.location}` : ""}</small></span>
              </a>
            ))}
          </div>
        ) : (
          <div className="cs-card cs-empty"><b>Nothing on the calendar yet.</b>New dates appear here, and in your subscribed calendar, as soon as they&rsquo;re set.</div>
        )}
      </section>

      <form action="/client/calendar/reset" method="post" style={{ marginTop: 20 }}>
        <button className="cs-btn ghost sm"><RefreshCw /> Reset my private link</button>
      </form>
      <HelpFooter />
    </main>
  )
}
