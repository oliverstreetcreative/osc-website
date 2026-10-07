import Link from "next/link"
import { headers } from "next/headers"
import { Check, CalendarDays, Receipt, Clapperboard, ArrowRight, FileSignature, FileText, ScrollText } from "lucide-react"
import { requireClientContext } from "@/lib/client/context"
import { orgProjects, needsYou, clientSignatures, type NeedsItem } from "@/lib/client/data"
import { KIND_LABEL, type SignViewer } from "@/lib/client/sign"
import { SignButton } from "@/app/client/sign-button"
import { StartCard } from "@/app/client/start-cards"
import { greeting, money, relativeDue, day, daysFromToday, duration } from "@/lib/client/format"
import { PosterImage, HelpFooter, PlayBadge, SectionTitle, DemoOff } from "@/app/client/ui"
import { isDemoSlug } from "@/lib/client/demo"
import { ProjectCard } from "@/app/client/project-card"
import { cutVersion, scriptAsk, shootWhen } from "@/lib/client/needs-words"
import { glanceHome } from "@/lib/client/glance"
import { GlanceSections } from "@/app/client/glance"
import { orgInvoices } from "@/lib/client/data"
import { seesMoney } from "@/lib/client/money"
import { todayEastern } from "@/lib/client/proposals"
import { isPreviewSession } from "@/lib/auth/require-session"

export const metadata = { title: "Home" }

// Fixed words for what the "Read and sign" route reports back (never text from the URL or the engine).
const SIGN_NOTICE: Record<string, string> = {
  office: "Sam will set this one up and let you know.",
  unavailable: "Paperwork is unavailable right now. Try again in a few minutes.",
}

export default async function Home({ searchParams }: { searchParams: { sign?: string } }) {
  const ctx = await requireClientContext()
  const projects = await orgProjects(ctx.org.id)
  // Sign Here contract v2: the viewer's own paper; staff viewing as the client read every member's (read-only).
  const viewer: SignViewer = ctx.viewing ? { staff: true } : { email: ctx.user.email }
  const signatures = await clientSignatures(ctx.org, projects, viewer)
  const needs = await needsYou(ctx.org.id, projects, signatures, ctx.viewing ? undefined : ctx.user.id, ctx.viewing ? undefined : ctx.user.email, ctx.role)
  const paperUnavailable = signatures.unavailable.size > 0
  const signNotice = searchParams.sign ? SIGN_NOTICE[searchParams.sign] ?? null : null
  const me = ctx.viewing ? "" : ctx.user.email.toLowerCase()
  // A staging screenshot sign-in sees the real Sign button, switched off (the start route refuses it too).
  const preview = (await isPreviewSession())
  const orgName = ctx.org.short_name ?? ctx.org.name
  const active = projects.filter((p) => p.phase !== "paid" && p.phase !== "delivered")
  // When nothing needs them: lead with the latest film, and list the rest below it.
  const latest = needs.length
    ? undefined
    : projects
        .flatMap((p) => p.deliverables.filter((f) => f.delivered_at || f.mux_playback_id).map((f) => ({ f, p })))
        .sort((a, b) => (b.f.delivered_at?.getTime() ?? 0) - (a.f.delivered_at?.getTime() ?? 0))[0]
  const finished = projects.filter((p) => (p.phase === "paid" || p.phase === "delivered") && p.id !== latest?.p.id)
  // SPEC §28 v2: the one-glance Home, on for its clients first (lib/client/glance.ts).
  const glance = glanceHome(ctx.org.slug)
  const money = seesMoney(ctx.role)
  const invoices = glance && money ? await orgInvoices(ctx.org.id, { withVoid: true }) : []

  return (
    <main className="cs-main">
      <p className="cs-eyebrow">{ctx.org.name}</p>
      <h1 className="cs-hello">
        {greeting()}, {ctx.user.first_name ?? ctx.user.name.split(" ")[0]}.
      </h1>

      <section className="cs-section" aria-labelledby="needs">
        <SectionTitle>
          <span id="needs">Needs you</span>
        </SectionTitle>
        {signNotice ? (
          <div className="cs-card cs-pad" role="status" style={{ marginBottom: 10 }}>
            <p>{signNotice}</p>
          </div>
        ) : null}
        {paperUnavailable ? (
          // Never "all set" while Sign Here can't answer (contract v2: fail closed, visibly).
          <div className="cs-card cs-need" style={{ marginBottom: 10 }}>
            <div className="cs-need-top">
              <span className="cs-eyebrow"><FileSignature size={13} style={{ verticalAlign: -2, marginRight: 6 }} />Paperwork</span>
            </div>
            <h3>Unavailable right now</h3>
            <p>We can&rsquo;t check what needs signing at the moment. Try again in a few minutes.</p>
          </div>
        ) : null}
        {needs.length ? (
          <div className="cs-list">
            {needs.map((n) => <NeedCard key={key(n)} n={n} demo={isDemoSlug(ctx.org.slug)} me={me} preview={preview} wordsOnly={glance} />)}
          </div>
        ) : paperUnavailable ? null : (
          <div className="cs-card cs-calm">
            <span className="cs-calm-dot"><Check size={22} /></span>
            <div>
              <h3>You&rsquo;re all set.</h3>
            </div>
          </div>
        )}
      </section>

      {glance ? (
        <GlanceSections projects={projects} needs={needs} invoices={invoices} money={money} today={todayEastern()} />
      ) : null}

      {!glance && latest ? (
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

      {!glance && active.length ? (
        <section className="cs-section">
          <SectionTitle href="/client/projects">In progress</SectionTitle>
          <div className="cs-grid">{active.map((p) => <ProjectCard key={p.id} p={p} orgName={orgName} logo={ctx.org.logo_path} />)}</div>
        </section>
      ) : null}

      {!glance && finished.length ? (
        <section className="cs-section">
          <SectionTitle href="/client/projects">{active.length || latest ? "Earlier work" : "Your projects"}</SectionTitle>
          <div className="cs-grid">{finished.map((p) => <ProjectCard key={p.id} p={p} orgName={orgName} logo={ctx.org.logo_path} />)}</div>
        </section>
      ) : null}

      {!projects.length ? (
        <section className="cs-section">
          <div className="cs-card cs-empty">
            <b>No projects yet.</b>
          </div>
        </section>
      ) : null}

      <StartCard ctx={ctx} />

      <section className="cs-section">
        <Link href="/client/calendar" className="cs-card cs-row" style={{ borderRadius: 16 }}>
          <span className="cs-ico"><CalendarDays /></span>
          <span className="cs-row-main">
            <strong>Add your dates to your calendar</strong>
            <small>Filming days and due dates</small>
          </span>
          <ArrowRight size={18} color="var(--mut)" />
        </Link>
      </section>

      <HelpFooter />
    </main>
  )
}

function key(n: NeedsItem) {
  if (n.kind === "proposal") return `p-${n.doc.id}`
  if (n.kind === "sign") return `g-${n.item.id}`
  if (n.kind === "script") return `c-${n.script.id}`
  return n.kind === "invoice" ? `i-${n.invoice.id}` : n.kind === "shoot" ? `s-${n.shoot.id}` : `r-${n.film.id}`
}

// demo: the staging demo org (SPEC §19). Its links are placeholders, so its buttons show "Off in the demo".
/** `wordsOnly`: the one-glance Home (SPEC §28 v2) shows no amounts, even on an invoice to pay; Billing has them. */
function NeedCard({ n, demo, me, preview, wordsOnly = false }: { n: NeedsItem; demo: boolean; me: string; preview: boolean; wordsOnly?: boolean }) {
  if (n.kind === "proposal") {
    // SPEC §24 v2: no price on the card (the PDF carries Sam's numbers); only its named acceptors see it.
    return (
      <div className="cs-card cs-need">
        <div className="cs-need-top">
          <span className="cs-eyebrow"><FileText size={13} style={{ verticalAlign: -2, marginRight: 6 }} />Proposal</span>
          {n.doc.good_until ? <span className="cs-status due">Good until {day(n.doc.good_until, { month: "short", day: "numeric" })}</span> : null}
        </div>
        <h3>A proposal for you{n.project ? ` · ${n.project.name}` : ""}</h3>
        <p>{n.doc.title}</p>
        <div className="cs-need-act">
          <Link className="cs-btn" href={`/client/proposals/${n.doc.id}`}>Read it</Link>
        </div>
      </div>
    )
  }
  if (n.kind === "script") {
    return (
      <div className="cs-card cs-need">
        <div className="cs-need-top">
          <span className="cs-eyebrow"><ScrollText size={13} style={{ verticalAlign: -2, marginRight: 6 }} />Script</span>
          <span className="cs-status due">{scriptAsk(n.script.status)}</span>
        </div>
        <h3>{n.script.title}</h3>
        <div className="cs-need-act">
          <Link className="cs-btn" href={`/client/scripts/${n.script.id}`}>Open the script</Link>
        </div>
      </div>
    )
  }
  if (n.kind === "sign") {
    const s = n.item
    const mine = !!me && s.who.email?.toLowerCase() === me
    return (
      <div className="cs-card cs-need">
        <div className="cs-need-top">
          <span className="cs-eyebrow"><FileSignature size={13} style={{ verticalAlign: -2, marginRight: 6 }} />To sign</span>
          {s.sample ? (
            <span className="cs-pill">Sample</span>
          ) : s.overdue ? (
            <span className="cs-status late">Overdue</span>
          ) : s.due ? (
            <span className="cs-status due">Due {day(new Date(s.due), { month: "short", day: "numeric" })}</span>
          ) : s.state === "sent" ? (
            <span className="cs-status due">Waiting for you</span>
          ) : null}
        </div>
        <h3>{s.label ?? KIND_LABEL[s.kind]} · {n.project.name}</h3>
        <p>{mine ? "For you" : `For ${s.who.name}`}</p>
        <div className="cs-need-act">
          {mine ? (
            <SignButton job={s.job} itemId={s.id} disabled={!s.can_start} preview={preview} />
          ) : (
            <span className="cs-status">Read-only while viewing</span>
          )}
        </div>
      </div>
    )
  }
  if (n.kind === "invoice") {
    const inv = n.invoice
    const late = inv.due_on ? daysFromToday(inv.due_on) < 0 : false
    return (
      <div className="cs-card cs-need">
        <div className="cs-need-top">
          <span className="cs-eyebrow"><Receipt size={13} style={{ verticalAlign: -2, marginRight: 6 }} />Invoice {inv.number}</span>
          <span className={`cs-status ${late ? "late" : "due"}`}>{relativeDue(inv.due_on)}</span>
        </div>
        <h3>{wordsOnly ? inv.title : `${money(inv.amount)} · ${inv.title}`}</h3>
        {inv.project ? <p>{inv.project.name}</p> : null}
        <div className="cs-need-act">
          {inv.pay_url ? (
            demo ? (
              <DemoOff label={wordsOnly ? "Pay" : `Pay ${money(inv.amount)}`} />
            ) : (
              <a className="cs-btn" href={inv.pay_url} target="_blank" rel="noopener">
                {wordsOnly ? "Pay" : `Pay ${money(inv.amount)}`}
              </a>
            )
          ) : null}
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
          <span className="cs-status soon">{shootWhen(inDays)}</span>
        </div>
        <h3>{day(s.start_date, { weekday: "long", month: "long", day: "numeric" })}{s.call_time ? `, ${s.call_time}` : ""}</h3>
        <p>{[n.project.name, s.location].filter(Boolean).join(" · ")}</p>
        <div className="cs-need-act">
          <Link className="cs-btn" href={`/client/projects/${n.project.slug}`}>See the day</Link>
        </div>
      </div>
    )
  }
  const ok = n.film.ask === "ok"
  const filmKey = n.film.ext_key?.split("/").pop() ?? ""
  return (
    <div className="cs-card cs-need">
      <div className="cs-need-top">
        <span className="cs-eyebrow"><Clapperboard size={13} style={{ verticalAlign: -2, marginRight: 6 }} />{ok ? "Ready for your OK" : "Ready for your notes"}</span>
      </div>
      {/* A cut on OSC Review: Review's own number when known, never the book's label (it may name another cut).
          A Frame.io or demo link keeps the book's label, as before. */}
      <h3>
        {n.film.name}
        {cutVersion(n.film, n.version_n)}
      </h3>
      <p>{n.project.name}</p>
      <div className="cs-need-act">
        {demo ? (
          <DemoOff label="Review the cut" />
        ) : ok && n.project.slug ? (
          <Link className="cs-btn" href={`/client/projects/${n.project.slug}/approve/${encodeURIComponent(filmKey)}`}>Watch and approve</Link>
        ) : (
          <a className="cs-btn" href={n.film.review_url!} target="_blank" rel="noopener">Watch and comment</a>
        )}
      </div>
    </div>
  )
}
