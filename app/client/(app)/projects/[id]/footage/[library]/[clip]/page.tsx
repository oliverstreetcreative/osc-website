// /client/projects/<slug>/footage/<library>/<clip>: one clip (SPEC §23 v2). The player (signed tokens minted for this
// view), its title and day, ♥ Favorite, ← → to its neighbours, and "Need a file of this? Text Sam" (no downloads in
// v1). The heart says only that it's saved to their favorites: nothing here claims OSC sees it.
import Link from "next/link"
import { headers } from "next/headers"
import { notFound } from "next/navigation"
import { ChevronLeft, ChevronRight, Heart } from "lucide-react"
import { requireClientContext } from "@/lib/client/context"
import { clipLength, findLibrary, heartsOf } from "@/lib/client/library"
import { playbackToken, signingReady, stillToken } from "@/lib/client/mux-sign"
import { isDemoSlug } from "@/lib/client/demo"
import { db } from "@/lib/db"
import { OSC_SMS } from "@/app/client/ui"
import { FootagePlayer } from "../../footage-player"

export const metadata = { title: "Footage" }

const SAVED: Record<string, string> = { "1": "Saved to your favorites.", "0": "Removed from your favorites." }

export default async function ClipPage({ params, searchParams }: { params: { id: string; library: string; clip: string }; searchParams: { saved?: string } }) {
  const ctx = await requireClientContext()
  const lib = await findLibrary(ctx.orgs.map((o) => o.id), params.id, params.library)
  if (!lib || !/^[0-9a-f-]{36}$/i.test(params.clip)) notFound()
  const clip = await db.libraryClip.findFirst({ where: { id: params.clip, library_id: lib.id, hidden: false } })
  if (!clip) notFound()
  const [prev, next] = await Promise.all([
    db.libraryClip.findFirst({ where: { library_id: lib.id, hidden: false, sort: { lt: clip.sort } }, orderBy: { sort: "desc" }, select: { id: true } }),
    db.libraryClip.findFirst({ where: { library_id: lib.id, hidden: false, sort: { gt: clip.sort } }, orderBy: { sort: "asc" }, select: { id: true } }),
  ])
  const ready = signingReady()
  const [playback, poster] = ready
    ? await Promise.all([playbackToken(clip.mux_playback_id), stillToken(clip.mux_playback_id, { time: clip.thumb_s ?? 1, width: 1280 })])
    : [null, null]
  const preview = (await headers()).get("x-user-preview") === "true"
  // A staging PREVIEW sign-in (the screenshot camera) sees the heart, switched off; the POST refuses it anyway.
  const canHeart = !ctx.viewing && !isDemoSlug(lib.project.organization?.slug)
  const hearted = canHeart ? (await heartsOf(ctx.user.id, [clip.id])).has(clip.id) : false
  const base = `/client/projects/${lib.project.slug}/footage/${lib.id}`
  const saved = searchParams.saved && Object.hasOwn(SAVED, searchParams.saved) ? SAVED[searchParams.saved] : null
  const day = clip.taken_on?.toLocaleDateString("en-US", { timeZone: "UTC", weekday: "short", month: "short", day: "numeric", year: "numeric" })

  return (
    <main className="cs-main">
      <Link href={base} className="cs-back">
        <ChevronLeft size={16} /> {lib.title}
      </Link>
      <section className="cs-section" style={{ marginTop: 12 }}>
        {ready ? (
          <FootagePlayer playbackId={clip.mux_playback_id} playback={playback} poster={poster} title={clip.title} aspect={(clip.aspect ?? "16:9").replace(":", "/")} />
        ) : (
          <div className="cs-card cs-pad">
            <p>Footage is unavailable right now. Try again later.</p>
          </div>
        )}
      </section>
      <h1 className="cs-title" style={{ marginTop: 16 }}>{clip.title}</h1>
      <p className="cs-lede">{[day, clipLength(clip.duration_s)].filter(Boolean).join(" · ")}</p>

      {saved ? (
        <p role="status" className="cs-lede" style={{ marginTop: 8, fontSize: 14 }}>
          {saved}
        </p>
      ) : null}

      <div className="cs-need-act" style={{ marginTop: 16 }}>
        {canHeart ? (
          <form method="post" action="/client/library/heart">
            <input type="hidden" name="clip_id" value={clip.id} />
            <input type="hidden" name="on" value={hearted ? "0" : "1"} />
            <button className={hearted ? "cs-btn" : "cs-btn ghost"} aria-pressed={hearted} disabled={preview}>
              <Heart size={16} fill={hearted ? "currentColor" : "none"} style={{ verticalAlign: -3, marginRight: 6 }} aria-hidden />
              Favorite
            </button>
          </form>
        ) : null}
      </div>

      <nav className="cs-need-act" style={{ marginTop: 16, justifyContent: "space-between" }} aria-label="Other clips">
        {prev ? (
          <Link className="cs-btn ghost" href={`${base}/${prev.id}`}>
            <ChevronLeft size={16} style={{ verticalAlign: -3 }} /> Previous
          </Link>
        ) : (
          <span />
        )}
        {next ? (
          <Link className="cs-btn ghost" href={`${base}/${next.id}`}>
            Next <ChevronRight size={16} style={{ verticalAlign: -3 }} />
          </Link>
        ) : null}
      </nav>

      <p className="cs-lede" style={{ marginTop: 24, fontSize: 14 }}>
        Need a file of this? <a className="cs-link" href={OSC_SMS}>Text Sam</a> and mention &ldquo;{clip.title}&rdquo;.
      </p>
    </main>
  )
}
