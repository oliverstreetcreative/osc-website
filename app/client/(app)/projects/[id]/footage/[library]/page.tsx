// /client/projects/<slug>/footage/<library>: the client's footage library (SPEC §23 v2). A grid of stills, 60 per
// page (Previous / Next, so a phone never re-signs and re-renders everything it already showed); chips All · Your
// favorites. Every still is a signed Mux image minted for this view (~400 px wide, the same URL for an hour so the
// phone can cache it). Staff viewing see each clip's title under its still, so the preview frames show Sam every
// still AND every title before his tap. Clips are Sam's own picks, published through the gate.
import Link from "next/link"
import { notFound } from "next/navigation"
import { ChevronLeft, ChevronRight, Heart } from "lucide-react"
import { requireClientContext } from "@/lib/client/context"
import { clipLength, dayRange, findLibrary, heartedInLibrary } from "@/lib/client/library"
import { signingReady, stillUrl } from "@/lib/client/mux-sign"
import { db } from "@/lib/db"
import { HelpFooter } from "@/app/client/ui"

export const metadata = { title: "Footage" }

const PAGE = 60
const ratio = (aspect: string | null) => (aspect ?? "16:9").replace(":", "/")

export default async function LibraryPage({ params, searchParams }: { params: { id: string; library: string }; searchParams: { show?: string; page?: string } }) {
  const ctx = await requireClientContext()
  const lib = await findLibrary(ctx.orgs.map((o) => o.id), params.id, params.library)
  if (!lib) notFound()
  const favoritesOnly = searchParams.show === "favorites" && !ctx.viewing
  const mine = ctx.viewing ? new Set<string>() : await heartedInLibrary(ctx.user.id, lib.id)
  const where = { library_id: lib.id, hidden: false, ...(favoritesOnly ? { id: { in: [...mine] } } : {}) }
  const total = await db.libraryClip.count({ where })
  const pages = Math.max(1, Math.ceil(total / PAGE))
  const page = Math.max(1, Math.min(pages, Number.parseInt(searchParams.page ?? "1", 10) || 1))
  const clips = await db.libraryClip.findMany({
    where,
    orderBy: { sort: "asc" },
    skip: (page - 1) * PAGE,
    take: PAGE,
    select: { id: true, title: true, mux_playback_id: true, thumb_s: true, duration_s: true, aspect: true },
  })
  const ready = signingReady()
  const stills = ready ? await Promise.all(clips.map((c) => stillUrl(c.mux_playback_id, { time: c.thumb_s ?? 1, width: 400 }))) : []
  const base = `/client/projects/${lib.project.slug}/footage/${lib.id}`
  const pageHref = (n: number) => `${base}?${new URLSearchParams({ ...(favoritesOnly ? { show: "favorites" } : {}), ...(n > 1 ? { page: String(n) } : {}) })}`
  const days = dayRange(lib.first_day, lib.last_day)

  return (
    <main className="cs-main">
      <Link href={`/client/projects/${lib.project.slug}`} className="cs-back">
        <ChevronLeft size={16} /> {lib.project.name}
      </Link>
      <p className="cs-eyebrow" style={{ marginTop: 12 }}>
        Footage
      </p>
      <h1 className="cs-title">{lib.title}</h1>
      <p className="cs-lede">{[`${lib.clip_count} clip${lib.clip_count === 1 ? "" : "s"}`, days].filter(Boolean).join(" · ")}</p>
      {lib.description ? <p style={{ marginTop: 8 }}>{lib.description}</p> : null}

      {!ctx.viewing ? (
        <nav className="cs-filters" aria-label="Show" style={{ marginTop: 16 }}>
          <Link href={base} aria-current={!favoritesOnly ? "true" : undefined}>All</Link>
          <Link href={`${base}?show=favorites`} aria-current={favoritesOnly ? "true" : undefined}>Your favorites</Link>
        </nav>
      ) : null}

      <section className="cs-section" style={{ marginTop: 16 }}>
        {!ready ? (
          <div className="cs-card cs-pad">
            <p>Footage is unavailable right now. Try again later.</p>
          </div>
        ) : clips.length ? (
          <div className="cs-footage">
            {clips.map((c, i) => (
              <div key={c.id}>
                <Link
                  href={`${base}/${c.id}`}
                  className="cs-still"
                  style={{ aspectRatio: ratio(c.aspect) }}
                  aria-label={`${c.title}, ${clipLength(c.duration_s)}${mine.has(c.id) ? ", one of your favorites" : ""}`}
                >
                  {stills[i] ? <img src={stills[i]!} alt="" loading={i < 8 ? "eager" : "lazy"} decoding="async" /> : null}
                  <span className="cs-len" aria-hidden>{clipLength(c.duration_s)}</span>
                  {mine.has(c.id) ? (
                    <span className="cs-heart" aria-hidden>
                      <Heart size={16} fill="currentColor" />
                    </span>
                  ) : null}
                </Link>
                {ctx.viewing ? <small className="cs-still-title">{c.title}</small> : null}
              </div>
            ))}
          </div>
        ) : (
          <div className="cs-card cs-empty">
            <b>{favoritesOnly ? "No favorites yet." : "No clips here."}</b>
            {favoritesOnly ? <Link className="cs-link" href={base}>Show everything</Link> : null}
          </div>
        )}
        {ready && pages > 1 ? (
          <nav className="cs-need-act" style={{ marginTop: 16, justifyContent: "space-between" }} aria-label="Pages">
            {page > 1 ? (
              <Link className="cs-btn ghost" href={pageHref(page - 1)}>
                <ChevronLeft size={16} style={{ verticalAlign: -3 }} /> Previous
              </Link>
            ) : (
              <span />
            )}
            <span className="cs-lede" style={{ fontSize: 14 }}>
              Page {page} of {pages}
            </span>
            {page < pages ? (
              <Link className="cs-btn ghost" href={pageHref(page + 1)}>
                Next <ChevronRight size={16} style={{ verticalAlign: -3 }} />
              </Link>
            ) : (
              <span />
            )}
          </nav>
        ) : null}
      </section>
      <HelpFooter />
    </main>
  )
}
