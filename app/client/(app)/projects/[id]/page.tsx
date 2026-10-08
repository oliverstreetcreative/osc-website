import Link from "next/link"
import { headers } from "next/headers"
import { notFound } from "next/navigation"
import { ChevronLeft, Download, ExternalLink, MapPin, Clock, Phone, MessageSquare, Mail, UserPlus } from "lucide-react"
import { requireClientContext } from "@/lib/client/context"
import { orgProject, orgInvoices, clientSignatures, visibleScriptsWhere, needsYou, needsProjectId } from "@/lib/client/data"
import { labelFor, reviewState, type ReviewState } from "@/lib/client/approvals"
import { dayRange } from "@/lib/client/library"
import { roleIn, seesProposals } from "@/lib/client/proposals"
import { MONEY_DOC_KINDS, invoiceFacts, moneyOf, namedOpenInvoices, resolveBlock } from "@/lib/client/money"
import { MoneySection } from "@/app/client/money-section"
import { WhereItStands } from "@/app/client/job-needs"
import { glanceHome } from "@/lib/client/glance"
import { todayEastern } from "@/lib/client/proposals"
import { signingReady, stillUrl } from "@/lib/client/mux-sign"
import { db } from "@/lib/db"
import { KIND_LABEL, SIGN_NOTICE, isDone, signedDay, signedNotCleared, type SignViewer } from "@/lib/client/sign"
import { SignButton } from "@/app/client/sign-button"
import { day, dayET, duration, money, relativeDue, muxThumb, daysFromToday, todayUTC } from "@/lib/client/format"
import { eventForOrgs, googleLink } from "@/lib/client/calendar"
import { pageOrigin } from "@/lib/client/host"
import { PosterImage, PhaseTracker, DocRow, HelpFooter, AddToCalendar, SectionTitle, DemoOff } from "@/app/client/ui"
import { isDemoSlug } from "@/lib/client/demo"
import { e164, isOscMember, prettyPhone, teamOf } from "@/lib/client/team"
import { isPreviewSession } from "@/lib/auth/require-session"

type Dl = { label: string; url?: string; path?: string; size?: string; note?: string }

// Look in the selected org first, then the person's other orgs (calendar links
// and emails don't know which org is selected).
async function findProject(ctx: Awaited<ReturnType<typeof requireClientContext>>, slug: string) {
  for (const o of [ctx.org, ...ctx.orgs.filter((x) => x.id !== ctx.org.id)]) {
    const p = await orgProject(o.id, slug)
    if (p) return { p, org: o }
  }
  return null
}

export async function generateMetadata({ params }: { params: { id: string } }) {
  const ctx = await requireClientContext()
  const found = await findProject(ctx, params.id)
  return { title: found?.p.name ?? "Project" }
}

export default async function ProjectPage({ params, searchParams }: { params: { id: string }; searchParams: { sign?: string } }) {
  const ctx = await requireClientContext()
  const found = await findProject(ctx, params.id)
  if (!found) notFound()
  const { p, org } = found
  const demo = isDemoSlug(org.slug) // the staging demo (SPEC §19): placeholder links, buttons off
  // Sign Here contract v2: the viewer's own paper (staff viewing: every member's, read-only); a failed read is
  // "unavailable", never an empty "all set".
  const viewer: SignViewer = ctx.viewing ? { staff: true } : { email: ctx.user.email }
  const signing = await clientSignatures(org, [p], viewer)
  const paper = signing.byProject.get(p.id) ?? []
  const paperUnavailable = signing.unavailable.has(p.id)
  const signNotice = searchParams.sign ? SIGN_NOTICE[searchParams.sign] ?? null : null
  const me = ctx.viewing ? "" : ctx.user.email.toLowerCase()
  // A staging screenshot sign-in sees the real Sign button, switched off (the start route refuses it too).
  const preview = (await isPreviewSession())
  const origin = await pageOrigin()
  const orgName = org.short_name ?? org.name
  const dates = (Array.isArray(p.dates) ? p.dates : []) as { label: string; date: string; note?: string }[]
  const team = teamOf(p.team)
  const today = todayUTC()
  // Cuts in review: the newest version and its approvals, live from Review (SPEC §13 v4; cached; read in parallel so
  // a slow Review costs one wait, not one per cut).
  const inReview = demo ? [] : p.deliverables.filter((f) => f.review_url && !f.delivered_at)
  const reviews = new Map<string, ReviewState>(await Promise.all(inReview.map(async (f) => [f.id, await reviewState(f)] as const)))
  // This project's scripts the person can open (SPEC §14: a Scripts section in each project).
  const scripts = await db.script.findMany({
    where: { ...visibleScriptsWhere(org.id, ctx.viewing ? undefined : ctx.user.id), project_id: p.id },
    select: { id: true, title: true, status: true, target_seconds: true },
    orderBy: { title: "asc" },
  })
  // Proposals are money (SPEC §24 v2): never listed for a VIEWER; an acceptance shows as "accepted" until Sam moves
  // the phase on.
  const role = (await roleIn(ctx, org.id)) ?? "VIEWER"
  const seesMoney = seesProposals(role)
  const files = p.documents.filter((d) => seesMoney || !MONEY_DOC_KINDS.includes(d.kind))
  // SPEC §28 v2: a job with a third-party payer shows who pays whom (only to someone who sees money). A client→OSC leg
  // reads its invoice, which may sit on another of the org's jobs, so the org's invoices are loaded.
  const moneyBlock = seesMoney ? moneyOf(p.money) : null
  const orgInvs = moneyBlock ? await orgInvoices(org.id, { withVoid: true }) : [] // the money model only (voided legs drop out)
  // SPEC §28 v2, "Where it stands": for the one-glance clients (lib/client/glance.ts), this job's own Needs-you items,
  // so Home's "1 thing for you" lands on the thing. An invoice the job's money lines say is owed counts here even when
  // it's filed on another of their jobs: the RESOLVED legs decide, by the one rule the balance and Home use.
  const glance = glanceHome(org.slug)
  const named = moneyBlock ? namedOpenInvoices(resolveBlock(moneyBlock, invoiceFacts(orgInvs), todayEastern())) : new Set<string>()
  const jobNeeds = glance
    ? (await needsYou(org.id, [p], signing, ctx.viewing ? undefined : ctx.user.id, ctx.viewing ? undefined : ctx.user.email, role)).filter(
        (n) => needsProjectId(n) === p.id || (n.kind === "invoice" && named.has(n.invoice.number)),
      )
    : []
  const accepted = seesMoney
    ? await db.proposalAcceptance.findFirst({ where: { project_id: p.id, withdrawn_at: null }, orderBy: { accepted_at: "desc" }, select: { name: true, accepted_at: true } })
    : null
  // Footage from Stacks (SPEC §23 v2): one row per published library, four signed stills each.
  const libraries = demo
    ? []
    : await db.library.findMany({ where: { project_id: p.id, hidden: false }, orderBy: [{ sort: "asc" }, { created_at: "asc" }] })
  const footageReady = signingReady()
  // Four stills per library, each its own small query (a nested `take` could load every clip of every library).
  const strips = new Map(
    footageReady
      ? await Promise.all(
          libraries.map(async (l) => {
            const four = await db.libraryClip.findMany({
              where: { library_id: l.id, hidden: false },
              orderBy: { sort: "asc" },
              take: 4,
              select: { mux_playback_id: true, thumb_s: true },
            })
            return [l.id, await Promise.all(four.map((c) => stillUrl(c.mux_playback_id, { time: c.thumb_s ?? 1, width: 400 })))] as const
          }),
        )
      : [],
  )

  // Timeline: shoot days + key dates, in date order.
  type Item = { when: Date; title: string; sub?: string; calId: string; shoot?: (typeof p.shoot_periods)[number] }
  const items: Item[] = [
    ...p.shoot_periods.map((s) => ({ when: s.start_date, title: s.description ?? "Filming day", calId: `shoot-${s.id}`, shoot: s })),
    ...dates.map((d, i) => ({ when: new Date(`${d.date}T12:00:00Z`), title: d.label, sub: d.note, calId: `date-${p.id}-${i}` })),
  ].sort((a, b) => a.when.getTime() - b.when.getTime())
  const calLinks = new Map<string, string>()
  for (const it of items.filter((i) => (i.shoot ? i.when >= today : i.when > today))) {
    const e = await eventForOrgs(it.calId, [org.id], seesMoney ? [org.id] : [])
    if (e) calLinks.set(it.calId, googleLink(e, origin))
  }

  return (
    <>
      <header className="cs-hero">
        {(p.poster_mux_id || p.poster_path) && (
          <div className="cs-hero-bg" aria-hidden>
            {p.poster_mux_id ? <img src={muxThumb(p.poster_mux_id, p.poster_time, 1600)} alt="" /> : <img src={`/client/poster/project/${p.id}`} alt="" />}
          </div>
        )}
        <div className="cs-hero-in">
          <Link href="/client/projects" className="cs-back"><ChevronLeft size={16} /> Projects</Link>
          <p className="cs-eyebrow">{[p.kind, p.job_number ? `No. ${p.job_number}` : null].filter(Boolean).join(" · ")}</p>
          <h1>{p.name}</h1>
          {p.status_line ? <p className="cs-hero-line">{p.status_line}</p> : null}
          {accepted && p.phase === "quote" ? (
            <p className="cs-hero-line">
              Proposal accepted {dayET(accepted.accepted_at)} by {accepted.name.split(/\s+/)[0]}.
            </p>
          ) : null}
          <PhaseTracker phase={p.phase} />
        </div>
      </header>

      <main className="cs-main" style={{ paddingTop: 8 }}>
        <div className="cs-cols">
          <div>
            {signNotice ? (
              <div className="cs-card cs-pad" role="status" style={{ marginTop: 14 }}>
                <p>{signNotice}</p>
              </div>
            ) : null}
            {/* Where it stands (SPEC §28 v2): what's next, right under what's happening (the hero line); for the one-glance
                clients, the job's own Needs-you list too. */}
            {glance ? (
              <WhereItStands next={p.next_step} items={jobNeeds} job={{ id: p.id, slug: p.slug }} demo={demo} paperUnavailable={paperUnavailable} />
            ) : p.next_step ? (
              <div className="cs-card cs-pad" style={{ marginTop: 14 }}>
                <p style={{ fontSize: 15 }}>
                  <b>Next</b> · {p.next_step}
                </p>
              </div>
            ) : null}

            {/* Scripts first when the job has them (SPEC §28 v2: the scripting tool front and center). */}
            {scripts.length ? (
              <section className="cs-section">
                <SectionTitle>{scripts.length > 1 ? "Scripts" : "Script"}</SectionTitle>
                <div className="cs-rows">
                  {scripts.map((s) => (
                    <Link key={s.id} href={`/client/scripts/${s.id}`} className="cs-row">
                      <span className="cs-row-main">
                        <b>{s.title}</b>
                        {s.target_seconds ? <span className="cs-status"> · :{s.target_seconds}</span> : null}
                      </span>
                      {s.status === "ready_for_notes" ? (
                        <span className="cs-pill now">Ready for your notes</span>
                      ) : s.status === "ready_for_ok" ? (
                        <span className="cs-pill now">Ready for your OK</span>
                      ) : s.status === "approved" ? (
                        <span className="cs-pill done">Approved</span>
                      ) : null}
                    </Link>
                  ))}
                </div>
              </section>
            ) : null}

            {p.deliverables.length ? (
              <section className="cs-section">
                <SectionTitle>{p.deliverables.length > 1 ? "Films" : "Film"}</SectionTitle>
                <div className="cs-list" style={{ gap: 16 }}>
                  {p.deliverables.map((f) => {
                    const downloads = (Array.isArray(f.downloads) ? f.downloads : []) as Dl[]
                    // A cut read from Review shows Sam's label only when the book binds it to the version on screen.
                    const st = reviews.get(f.id)
                    const label = !st || st.kind === "none" ? f.version_label : st.kind === "ok" ? labelFor(f, st.newest.id) : null
                    return (
                      <article key={f.id} className="cs-card cs-film">
                        <FilmPlayer f={f} project={p} orgName={orgName} logo={org.logo_path} />
                        <div className="cs-film-body">
                          <h3>{f.name}</h3>
                          <p className="cs-film-meta">
                            {[label, duration(f.duration_s), f.delivered_at ? `Delivered ${day(f.delivered_at)}` : null].filter(Boolean).join(" · ")}
                          </p>
                          {f.description ? <p className="cs-film-desc">{f.description}</p> : null}
                          {f.review_url && !f.delivered_at && demo ? (
                            <DemoOff label="Review this cut" style={{ marginTop: 14, width: "100%" }} />
                          ) : f.review_url && !f.delivered_at ? (
                            <FilmReview f={f} state={reviews.get(f.id) ?? { kind: "none" }} slug={p.slug} me={me} />
                          ) : null}
                          {downloads.length || f.watch_url ? (
                            <div className="cs-dl">
                              {f.watch_url && !f.file_path && !f.mux_playback_id ? (
                                <a href={f.watch_url} target="_blank" rel="noopener"><ExternalLink /><span>{downloads.length ? "Watch" : "Watch and download"}</span><small>Frame.io</small></a>
                              ) : null}
                              {downloads.map((d, i) => demo ? (
                                <span key={i} className="is-off-row" aria-disabled="true" title="Off in the demo">
                                  <Download />
                                  <span>{d.label}</span>
                                  <small>Off in the demo</small>
                                </span>
                              ) : (
                                <a key={i} href={d.path ? `/client/download/${f.id}/${i}` : d.url} target={d.path ? undefined : "_blank"} rel="noopener">
                                  {d.path ? <Download /> : <ExternalLink />}
                                  <span>{d.label}</span>
                                  <small>{d.size ?? d.note ?? ""}</small>
                                </a>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      </article>
                    )
                  })}
                </div>
              </section>
            ) : null}

            {libraries.length ? (
              <section className="cs-section">
                <SectionTitle>Footage</SectionTitle>
                <div className="cs-list" style={{ gap: 12 }}>
                  {libraries.map((l) => (
                    <Link key={l.id} href={`/client/projects/${p.slug}/footage/${l.id}`} className="cs-card cs-pad" style={{ display: "block" }}>
                      <strong>{l.title}</strong>
                      <p className="cs-film-meta">
                        {[`${l.clip_count} clip${l.clip_count === 1 ? "" : "s"}`, dayRange(l.first_day, l.last_day)].filter(Boolean).join(" · ")}
                      </p>
                      {footageReady ? (
                        <div className="cs-strip" aria-hidden>
                          {(strips.get(l.id) ?? []).map((src, i) => (src ? <img key={i} src={src} alt="" loading="lazy" decoding="async" /> : <span key={i} />))}
                        </div>
                      ) : (
                        <p className="cs-film-meta">Footage is unavailable right now.</p>
                      )}
                      <span className="cs-btn ghost" style={{ marginTop: 12, width: "100%" }}>Browse</span>
                    </Link>
                  ))}
                </div>
              </section>
            ) : null}

            {p.summary ? (
              <section className="cs-section">
                <SectionTitle>About this project</SectionTitle>
                <div className="cs-card cs-pad"><p style={{ fontSize: 15 }}>{p.summary}</p></div>
              </section>
            ) : null}
          </div>

          <div>
            {items.length ? (
              <section className="cs-section" id="dates">
                <SectionTitle>Key dates</SectionTitle>
                <div className="cs-card cs-dates">
                  {items.map((it) => {
                    const past = it.when < today
                    const s = it.shoot
                    return (
                      <div key={it.calId} className={`cs-date ${past ? "past" : ""}`}>
                        <time dateTime={it.when.toISOString().slice(0, 10)}>{day(it.when, { month: "short", day: "numeric" })}<br /><span style={{ fontWeight: 500 }}>{it.when.getUTCFullYear()}</span></time>
                        <div>
                          <strong>{it.title}</strong>
                          {s?.call_time ? <small><Clock size={12} style={{ verticalAlign: -1 }} /> Call {s.call_time}</small> : null}
                          {s?.location ? <small><MapPin size={12} style={{ verticalAlign: -1 }} /> {s.location}{s.address ? `, ${s.address}` : ""}</small> : null}
                          {s?.address && !past ? (
                            // SPEC §21 v2: the map pin is the SHOOT's address (never a person's), as one https link.
                            <a
                              className="cs-link cs-directions"
                              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([s.location, s.address].filter(Boolean).join(", "))}`}
                              target="_blank"
                              rel="noopener"
                            >
                              <MapPin size={14} /> Directions
                            </a>
                          ) : null}
                          {s?.bring ? <small>Bring: {s.bring}</small> : null}
                          {it.sub ? <small>{it.sub}</small> : null}
                          {calLinks.has(it.calId) ? <AddToCalendar id={it.calId} google={calLinks.get(it.calId)!} /> : null}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </section>
            ) : null}

            {seesMoney && moneyBlock ? (
              <MoneySection block={moneyBlock} invoices={orgInvs} today={todayEastern()} projectId={p.id} />
            ) : null}

            {seesMoney && p.invoices.length ? (
              <section className="cs-section" id="billing">
                <SectionTitle href="/client/billing" link="All billing">Billing</SectionTitle>
                <div className="cs-rows">
                  {p.invoices.map((inv) => (
                    <div key={inv.id} className="cs-row">
                      <span className="cs-row-main">
                        <strong>{inv.title}</strong>
                        <small>Invoice {inv.number} · {day(inv.issued_on)}</small>
                      </span>
                      <span className="cs-row-end">
                        <strong>{money(inv.amount)}</strong>
                        {inv.status === "paid" ? (
                          <span className="cs-status paid">{inv.paid_on ? `Paid ${day(inv.paid_on, { month: "short", day: "numeric" })}` : "Paid"}</span>
                        ) : (
                          <span className={`cs-status ${inv.due_on && daysFromToday(inv.due_on) < 0 ? "late" : "due"}`}>{relativeDue(inv.due_on)}</span>
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}

            {paper.length || paperUnavailable ? (
              <section className="cs-section" id="paperwork">
                <SectionTitle>Paperwork</SectionTitle>
                <div className="cs-rows">
                  {paperUnavailable ? (
                    <div className="cs-row">
                      <span className="cs-row-main">
                        <strong>Unavailable right now</strong>
                        <small>We can&rsquo;t check what needs signing at the moment. Try again in a few minutes.</small>
                      </span>
                    </div>
                  ) : null}
                  {paper.map((s) => {
                    const mine = !!me && s.who.email?.toLowerCase() === me
                    const done = isDone(s)
                    return (
                      <div key={s.id} className="cs-row" style={{ flexWrap: "wrap" }}>
                        <span className="cs-row-main">
                          <strong>{s.label ?? KIND_LABEL[s.kind]}{s.sample ? " · sample" : ""}</strong>
                          <small>{mine ? "For you" : `For ${s.who.name}`}</small>
                        </span>
                        <span className="cs-row-end">
                          {done ? (
                            <>
                              <span className="cs-status paid">
                                Signed{signedDay(s.signed_at) ? ` ${signedDay(s.signed_at)}` : ""}
                              </span>
                              {mine && s.agreement_id ? (
                                <a className="cs-link" href={`/client/sign/receipt/${encodeURIComponent(s.agreement_id)}?org=${encodeURIComponent(org.slug)}`} target="_blank" rel="noopener">Your copy</a>
                              ) : null}
                            </>
                          ) : s.state === "signed_sample" ? (
                            // A client sees a signed sample only on staging (SPEC §22 v2.1; staff viewing see samples,
                            // marked, anywhere). Its own copy proves the receipt path; the engine serves it to its signer alone.
                            <>
                              <span className="cs-status">Sample signed (doesn&rsquo;t count)</span>
                              {mine && s.agreement_id ? (
                                <a className="cs-link" href={`/client/sign/receipt/${encodeURIComponent(s.agreement_id)}?org=${encodeURIComponent(org.slug)}`} target="_blank" rel="noopener">Your copy</a>
                              ) : null}
                            </>
                          ) : signedNotCleared(s) ? (
                            // Signed by them; OSC's side isn't finished (a countersignature, more days). Nothing to do here.
                            <span className="cs-status">
                              Signed{signedDay(s.signed_at) ? ` ${signedDay(s.signed_at)}` : ""}
                            </span>
                          ) : mine ? (
                            <>
                              {s.overdue ? <span className="cs-status late">Overdue</span> : s.due ? (
                                <span className="cs-status due">Due {day(new Date(s.due), { month: "short", day: "numeric" })}</span>
                              ) : null}
                              <SignButton job={s.job} itemId={s.id} org={org.slug} disabled={!s.can_start} preview={preview} />
                            </>
                          ) : (
                            <span className="cs-status due">Waiting on {s.who.name.split(" ")[0]}</span>
                          )}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </section>
            ) : null}

            {files.length ? (
              <section className="cs-section">
                <SectionTitle href="/client/documents" link="All documents">Files</SectionTitle>
                <div className="cs-rows">{files.map((d) => <DocRow key={d.id} doc={d} showProject={false} />)}</div>
              </section>
            ) : null}

            {team.length ? (
              <section className="cs-section">
                <SectionTitle>Your team</SectionTitle>
                <div className="cs-rows">
                  {team.map((t) => {
                    // SPEC §21 v2: an icon only for a detail that exists; call/text on phones, the number as text on
                    // desktops (no dead tel: links); "text" only for a mobile; Save contact = a vCard.
                    const id = t.uid // unique on this card
                    const tel = e164(t.phone)
                    const shown = prettyPhone(t.phone)
                    return (
                      <div key={id} className="cs-row cs-member">
                        <span className="cs-avatar" style={{ width: 40, height: 40 }}>{t.name.slice(0, 1)}</span>
                        <span className="cs-row-main">
                          <strong>{t.name}</strong>
                          <small>{t.role}</small>
                          {shown ? <small className="cs-member-num">{shown}</small> : null}
                        </span>
                        {tel || t.email ? (
                          <span className="cs-member-acts">
                            {tel ? (
                              <a className="cs-round touch-only" href={`tel:${tel}`} aria-label={`Call ${t.name}`}><Phone /></a>
                            ) : null}
                            {tel && t.mobile ? (
                              <a className="cs-round touch-only" href={`sms:${tel}`} aria-label={`Text ${t.name}`}><MessageSquare /></a>
                            ) : null}
                            {t.email ? (
                              <a className="cs-round" href={`mailto:${t.email}`} aria-label={`Email ${t.name}`}><Mail /></a>
                            ) : null}
                            {isOscMember(t) ? (
                              <a className="cs-round" href={`/client/team/${p.slug}/${id}`} aria-label={`Save ${t.name}'s contact`}><UserPlus /></a>
                            ) : null}
                          </span>
                        ) : null}
                      </div>
                    )
                  })}
                </div>
              </section>
            ) : null}
          </div>
        </div>
        <HelpFooter />
      </main>
    </>
  )
}

/** A cut in review (SPEC §13 v3 phone moments): newest version + posted date, approvals, and the one right button. */
function FilmReview({ f, state, slug, me }: {
  f: { ext_key: string | null; review_url: string | null; ask: string; approvers: unknown }
  state: ReviewState
  slug: string | null
  /** The signed-in client's email ("" while staff view the site). */
  me: string
}) {
  const filmKey = f.ext_key?.split("/").pop() ?? ""
  const approveHref = slug ? `/client/projects/${slug}/approve/${encodeURIComponent(filmKey)}` : null
  const approvedNewest = state.kind === "ok" ? state.approvals.filter((a) => a.version_id === state.newest.id) : []
  // "Watch and approve" only for an approver who still has something to approve; everyone else watches the same cut
  // in place (or in Review when the portal can't read the link).
  const approver = !!me && Array.isArray(f.approvers) && f.approvers.some((e) => typeof e === "string" && e.toLowerCase() === me)
  const toApprove = state.kind === "ok" && approver && !state.newestApproved && !approvedNewest.some((a) => a.email === me)
  return (
    <div style={{ marginTop: 14 }}>
      {state.kind === "ok" ? (
        <p className="cs-film-meta">
          In review · Version {state.newest.n}
          {state.newest.posted_at ? ` · posted ${dayET(state.newest.posted_at)}` : ""}
          {approvedNewest.length ? ` · Approved by ${approvedNewest.map((a) => a.name.split(/\s+/)[0]).join(", ")} · ${dayET(approvedNewest[0].at)}` : ""}
        </p>
      ) : state.kind === "error" ? (
        <p className="cs-film-meta">{state.words}</p>
      ) : null}
      {f.ask === "ok" && approveHref && state.kind === "ok" ? (
        <Link className="cs-btn" style={{ marginTop: 10, width: "100%" }} href={approveHref}>
          {toApprove ? "Watch and approve" : "Watch the cut"}
        </Link>
      ) : (
        <a className="cs-btn" style={{ marginTop: 10, width: "100%" }} href={f.review_url ?? "#"} target="_blank" rel="noopener">
          Watch and comment
        </a>
      )}
    </div>
  )
}

function FilmPlayer({ f, project, orgName, logo }: {
  f: { id: string; name: string; mux_playback_id: string | null; poster_time: number | null; file_path: string | null; poster_path: string | null; aspect: string | null; watch_url: string | null; review_url: string | null }
  project: Parameters<typeof PosterImage>[0]["project"]
  orgName: string
  logo: string | null
}) {
  const aspect = f.aspect ?? "16/9"
  if (f.mux_playback_id) {
    const thumb = encodeURIComponent(muxThumb(f.mux_playback_id, f.poster_time, 1280))
    return (
      <div className="cs-player" style={{ aspectRatio: aspect }}>
        <iframe
          src={`https://player.mux.com/${f.mux_playback_id}?accent-color=%23E07830&thumbnail_time=${f.poster_time ?? 0}&poster=${thumb}`}
          title={f.name}
          allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
          loading="lazy"
        />
      </div>
    )
  }
  if (f.file_path) {
    return (
      <div className="cs-player" style={{ aspectRatio: aspect }}>
        {/* With a poster still: show it and load nothing until play (masters can open on a slate).
            Without one: let the browser paint a frame from half a second in. */}
        <video
          controls
          playsInline
          preload={f.poster_path ? "none" : "metadata"}
          poster={f.poster_path ? `/client/poster/film/${f.id}` : undefined}
        >
          <source src={f.poster_path ? `/client/media/${f.id}` : `/client/media/${f.id}#t=0.5`} type="video/mp4" />
        </video>
      </div>
    )
  }
  const link = f.watch_url ?? f.review_url
  return (
    <a className="cs-poster" href={link ?? undefined} target="_blank" rel="noopener" style={{ display: "block" }}>
      <PosterImage project={{ ...project, name: f.name }} orgName={orgName} logo={logo} />
      {link ? <span className="cs-poster-tag">{f.watch_url ? "Watch on Frame.io" : "Review on Frame.io"}</span> : null}
      {link ? <span className="cs-play" aria-hidden><svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg></span> : null}
    </a>
  )
}
