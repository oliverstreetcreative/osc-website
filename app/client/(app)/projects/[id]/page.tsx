import Link from "next/link"
import { notFound } from "next/navigation"
import { ChevronLeft, Download, ExternalLink, MapPin, Clock } from "lucide-react"
import { requireClientContext } from "@/lib/client/context"
import { orgProject, clientSignatures } from "@/lib/client/data"
import { KIND_LABEL } from "@/lib/client/sign"
import { SignButton } from "@/app/client/sign-button"
import { day, duration, money, relativeDue, muxThumb, daysFromToday, todayUTC } from "@/lib/client/format"
import { eventForOrgs, googleLink } from "@/lib/client/calendar"
import { pageOrigin } from "@/lib/client/host"
import { PosterImage, PhaseTracker, DocRow, HelpFooter, AddToCalendar, SectionTitle, DemoOff } from "@/app/client/ui"
import { isDemoSlug } from "@/lib/client/demo"

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

export default async function ProjectPage({ params }: { params: { id: string } }) {
  const ctx = await requireClientContext()
  const found = await findProject(ctx, params.id)
  if (!found) notFound()
  const { p, org } = found
  const demo = isDemoSlug(org.slug) // the staging demo (SPEC §19): placeholder links, buttons off
  const paper = (await clientSignatures(org.id, [p], !!ctx.viewing)).get(p.id) ?? []
  const me = ctx.viewing ? "" : ctx.user.email.toLowerCase()
  const origin = await pageOrigin()
  const orgName = org.short_name ?? org.name
  const dates = (Array.isArray(p.dates) ? p.dates : []) as { label: string; date: string; note?: string }[]
  const team = (Array.isArray(p.team) ? p.team : []) as { name: string; role: string }[]
  const today = todayUTC()

  // Timeline: shoot days + key dates, in date order.
  type Item = { when: Date; title: string; sub?: string; calId: string; shoot?: (typeof p.shoot_periods)[number] }
  const items: Item[] = [
    ...p.shoot_periods.map((s) => ({ when: s.start_date, title: s.description ?? "Filming day", calId: `shoot-${s.id}`, shoot: s })),
    ...dates.map((d, i) => ({ when: new Date(`${d.date}T12:00:00Z`), title: d.label, sub: d.note, calId: `date-${p.id}-${i}` })),
  ].sort((a, b) => a.when.getTime() - b.when.getTime())
  const calLinks = new Map<string, string>()
  for (const it of items.filter((i) => (i.shoot ? i.when >= today : i.when > today))) {
    const e = await eventForOrgs(it.calId, [org.id])
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
          <PhaseTracker phase={p.phase} />
        </div>
      </header>

      <main className="cs-main" style={{ paddingTop: 8 }}>
        <div className="cs-cols">
          <div>
            {p.deliverables.length ? (
              <section className="cs-section">
                <SectionTitle>{p.deliverables.length > 1 ? "Films" : "Film"}</SectionTitle>
                <div className="cs-list" style={{ gap: 16 }}>
                  {p.deliverables.map((f) => {
                    const downloads = (Array.isArray(f.downloads) ? f.downloads : []) as Dl[]
                    return (
                      <article key={f.id} className="cs-card cs-film">
                        <FilmPlayer f={f} project={p} orgName={orgName} logo={org.logo_path} />
                        <div className="cs-film-body">
                          <h3>{f.name}</h3>
                          <p className="cs-film-meta">
                            {[f.version_label, duration(f.duration_s), f.delivered_at ? `Delivered ${day(f.delivered_at)}` : null].filter(Boolean).join(" · ")}
                          </p>
                          {f.description ? <p className="cs-film-desc">{f.description}</p> : null}
                          {f.review_url && !f.delivered_at && demo ? (
                            <DemoOff label="Review this cut" style={{ marginTop: 14, width: "100%" }} />
                          ) : f.review_url && !f.delivered_at ? (
                            <a className="cs-btn" style={{ marginTop: 14, width: "100%" }} href={f.review_url} target="_blank" rel="noopener">Review this cut</a>
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

            {p.summary ? (
              <section className="cs-section">
                <SectionTitle>About this project</SectionTitle>
                <div className="cs-card cs-pad"><p style={{ fontSize: 15 }}>{p.summary}</p></div>
              </section>
            ) : null}
          </div>

          <div>
            {items.length ? (
              <section className="cs-section">
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

            {p.invoices.length ? (
              <section className="cs-section">
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

            {paper.length ? (
              <section className="cs-section">
                <SectionTitle>Paperwork</SectionTitle>
                <div className="cs-rows">
                  {paper.map((s) => {
                    const mine = !!me && s.who.email?.toLowerCase() === me
                    return (
                      <div key={s.id} className="cs-row" style={{ flexWrap: "wrap" }}>
                        <span className="cs-row-main">
                          <strong>{KIND_LABEL[s.kind]}{s.sample ? " · sample" : ""}</strong>
                          <small>{mine ? "For you" : `For ${s.who.name}`}</small>
                        </span>
                        <span className="cs-row-end">
                          {s.status === "signed" ? (
                            <>
                              <span className="cs-status paid">
                                Signed{s.signed_at ? ` ${day(new Date(s.signed_at), { month: "short", day: "numeric" })}` : ""}
                              </span>
                              {mine && s.agreement_id ? (
                                <a className="cs-link" href={`/client/sign/receipt/${s.agreement_id}`} target="_blank" rel="noopener">Your copy</a>
                              ) : null}
                            </>
                          ) : mine ? (
                            <SignButton job={s.job} itemId={s.id} template={s.templates[0] ?? ""} disabled={!s.can_start || !s.templates.length} />
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

            {p.documents.length ? (
              <section className="cs-section">
                <SectionTitle href="/client/documents" link="All documents">Files</SectionTitle>
                <div className="cs-rows">{p.documents.map((d) => <DocRow key={d.id} doc={d} showProject={false} />)}</div>
              </section>
            ) : null}

            {team.length ? (
              <section className="cs-section">
                <SectionTitle>Your team</SectionTitle>
                <div className="cs-rows">
                  {team.map((t) => (
                    <div key={t.name} className="cs-row">
                      <span className="cs-avatar" style={{ width: 40, height: 40 }}>{t.name.slice(0, 1)}</span>
                      <span className="cs-row-main"><strong>{t.name}</strong><small>{t.role}</small></span>
                    </div>
                  ))}
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
