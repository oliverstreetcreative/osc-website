import Link from "next/link"
import { Check, CalendarDays, Receipt, Clapperboard, ArrowRight } from "lucide-react"
import { requireClientContext } from "@/lib/client/context"
import { orgProjects, needsYou, type NeedsItem } from "@/lib/client/data"
import { greeting, money, relativeDue, day, daysFromToday, duration } from "@/lib/client/format"
import { PosterImage, HelpFooter, PlayBadge, SectionTitle } from "@/app/client/ui"
import { ProjectCard } from "@/app/client/project-card"

export const metadata = { title: "Home" }

export default async function Home() {
  const ctx = await requireClientContext()
  const projects = await orgProjects(ctx.org.id)
  const needs = await needsYou(ctx.org.id, projects)
  const orgName = ctx.org.short_name ?? ctx.org.name
  const active = projects.filter((p) => p.phase !== "paid" && p.phase !== "delivered")
  // When nothing needs them: lead with the latest film, and list the rest below it.
  const latest = needs.length
    ? undefined
    : projects
        .flatMap((p) => p.deliverables.filter((f) => f.delivered_at || f.mux_playback_id).map((f) => ({ f, p })))
        .sort((a, b) => (b.f.delivered_at?.getTime() ?? 0) - (a.f.delivered_at?.getTime() ?? 0))[0]
  const finished = projects.filter((p) => (p.phase === "paid" || p.phase === "delivered") && p.id !== latest?.p.id)

  return (
    <main className="cs-main">
      <p className="cs-eyebrow">{ctx.org.name}</p>
      <h1 className="cs-hello">
        {greeting()}, {ctx.user.first_name ?? ctx.user.name.split(" ")[0]}.
      </h1>

      <section className="cs-section" aria-labelledby="needs">
        <SectionTitle>
          <span id="needs">{needs.length ? "Needs you" : "Where things stand"}</span>
        </SectionTitle>
        {needs.length ? (
          <div className="cs-list">
            {needs.map((n) => <NeedCard key={key(n)} n={n} />)}
          </div>
        ) : (
          <div className="cs-card cs-calm">
            <span className="cs-calm-dot"><Check size={22} /></span>
            <div>
              <h3>You&rsquo;re all caught up.</h3>
              <p>Nothing needs you right now. We&rsquo;ll email you when something does.</p>
            </div>
          </div>
        )}
      </section>

      {latest ? (
        <section className="cs-section">
          <SectionTitle>Your latest film</SectionTitle>
          <Link href={`/client/projects/${latest.p.slug}`} className="cs-card cs-pcard">
            <div className="cs-poster">
              <PosterImage project={latest.p} orgName={orgName} logo={ctx.org.logo_path} width={1280} />
              <span className="cs-poster-tag">{latest.p.kind}</span>
              {latest.f.mux_playback_id || latest.f.file_path ? <PlayBadge /> : null}
            </div>
            <div className="cs-pcard-body">
              <h3>{latest.f.name}</h3>
              <p>
                {[latest.f.version_label, duration(latest.f.duration_s), latest.f.delivered_at ? `Delivered ${day(latest.f.delivered_at)}` : null]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </div>
          </Link>
        </section>
      ) : null}

      {active.length ? (
        <section className="cs-section">
          <SectionTitle href="/client/projects">In progress</SectionTitle>
          <div className="cs-grid">{active.map((p) => <ProjectCard key={p.id} p={p} orgName={orgName} logo={ctx.org.logo_path} />)}</div>
        </section>
      ) : null}

      {finished.length ? (
        <section className="cs-section">
          <SectionTitle href="/client/projects">{active.length || latest ? "Earlier work" : "Your projects"}</SectionTitle>
          <div className="cs-grid">{finished.map((p) => <ProjectCard key={p.id} p={p} orgName={orgName} logo={ctx.org.logo_path} />)}</div>
        </section>
      ) : null}

      {!projects.length ? (
        <section className="cs-section">
          <div className="cs-card cs-empty">
            <b>Your projects will show up here.</b>
            As soon as we start working together, this is where you&rsquo;ll find dates, cuts to review, finished films and bills.
          </div>
        </section>
      ) : null}

      <section className="cs-section">
        <Link href="/client/calendar" className="cs-card cs-row" style={{ borderRadius: 16 }}>
          <span className="cs-ico"><CalendarDays /></span>
          <span className="cs-row-main">
            <strong>Put every project date in your calendar</strong>
            <small>Filming days and due dates, kept up to date for you</small>
          </span>
          <ArrowRight size={18} color="var(--muted)" />
        </Link>
      </section>

      <HelpFooter />
    </main>
  )
}

function key(n: NeedsItem) {
  return n.kind === "invoice" ? `i-${n.invoice.id}` : n.kind === "shoot" ? `s-${n.shoot.id}` : `r-${n.film.id}`
}

function NeedCard({ n }: { n: NeedsItem }) {
  if (n.kind === "invoice") {
    const inv = n.invoice
    const late = inv.due_on ? daysFromToday(inv.due_on) < 0 : false
    return (
      <div className="cs-card cs-need">
        <div className="cs-need-top">
          <span className="cs-eyebrow"><Receipt size={13} style={{ verticalAlign: -2, marginRight: 6 }} />Invoice {inv.number}</span>
          <span className={`cs-status ${late ? "late" : "due"}`}>{relativeDue(inv.due_on)}</span>
        </div>
        <h3>{money(inv.amount)} · {inv.title}</h3>
        {inv.project ? <p>{inv.project.name}</p> : null}
        <div className="cs-need-act">
          {inv.pay_url ? <a className="cs-btn" href={inv.pay_url} target="_blank" rel="noopener">Pay {money(inv.amount)}</a> : null}
          <Link className="cs-btn ghost" href="/client/billing">Details</Link>
        </div>
      </div>
    )
  }
  if (n.kind === "shoot") {
    const s = n.shoot
    const inDays = daysFromToday(s.start_date)
    return (
      <div className="cs-card cs-need">
        <div className="cs-need-top">
          <span className="cs-eyebrow"><CalendarDays size={13} style={{ verticalAlign: -2, marginRight: 6 }} />{s.description ?? "Filming day"}</span>
          <span className="cs-status soon">{inDays < 0 ? "Happening now" : inDays === 0 ? "Today" : inDays === 1 ? "Tomorrow" : `In ${inDays} days`}</span>
        </div>
        <h3>{day(s.start_date, { weekday: "long", month: "long", day: "numeric" })}{s.call_time ? `, ${s.call_time}` : ""}</h3>
        <p>{[n.project.name, s.location].filter(Boolean).join(" · ")}</p>
        <div className="cs-need-act">
          <Link className="cs-btn" href={`/client/projects/${n.project.slug}`}>See the day</Link>
        </div>
      </div>
    )
  }
  return (
    <div className="cs-card cs-need">
      <div className="cs-need-top">
        <span className="cs-eyebrow"><Clapperboard size={13} style={{ verticalAlign: -2, marginRight: 6 }} />Ready for your notes</span>
      </div>
      <h3>{n.film.name}{n.film.version_label ? ` · ${n.film.version_label}` : ""}</h3>
      <p>{n.project.name}</p>
      <div className="cs-need-act">
        <a className="cs-btn" href={n.film.review_url!} target="_blank" rel="noopener">Review the cut</a>
      </div>
    </div>
  )
}
