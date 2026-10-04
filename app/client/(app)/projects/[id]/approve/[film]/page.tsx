// /client/projects/<slug>/approve/<film>: a cut in review (SPEC §13 v4). The newest version, played in place, with
// Review's own numbering and Sam's v-number; who has approved what; and, for the film's approvers when Sam asks for an
// OK, "Approve version N" under that exact player. Approving re-reads Review: a newer cut means watch it first.
import Link from "next/link"
import { notFound } from "next/navigation"
import { ChevronLeft } from "lucide-react"
import { requireClientContext } from "@/lib/client/context"
import { orgProject } from "@/lib/client/data"
import { APPROVE_WORDS, approversOf, filmKeyOf, isApprover, reviewState, type ApproveCode } from "@/lib/client/approvals"
import { shareToken, versionStream } from "@/lib/client/review"
import { db } from "@/lib/db"
import { day } from "@/lib/client/format"
import { ReviewPlayer } from "./review-player"

export const metadata = { title: "Review" }

async function find(ctx: Awaited<ReturnType<typeof requireClientContext>>, slug: string) {
  for (const o of [ctx.org, ...ctx.orgs.filter((x) => x.id !== ctx.org.id)]) {
    const p = await orgProject(o.id, slug)
    if (p) return { p, org: o }
  }
  return null
}

const posted = (iso: string | null) => (iso ? day(new Date(iso), { month: "short", day: "numeric" }) : null)

export default async function ApprovePage({ params, searchParams }: { params: { id: string; film: string }; searchParams: { why?: string; at?: string } }) {
  const ctx = await requireClientContext()
  const found = await find(ctx, params.id)
  if (!found) notFound()
  const film = found.p.deliverables.find((f) => filmKeyOf(f.ext_key) === params.film)
  if (!film || !film.review_url) notFound()
  const state = await reviewState(film)
  const token = shareToken(film.review_url)
  const stream = state.kind === "ok" && token && film.review_asset_id ? await versionStream(token, film.review_asset_id, state.newest.id) : null
  const approver = !ctx.viewing && isApprover(film, ctx.user.email)
  const approvers = approversOf(film)
  const names = new Map(
    (await db.person.findMany({ where: { email: { in: approvers } }, select: { email: true, name: true, first_name: true } })).map((p) => [
      p.email.toLowerCase(),
      (p.first_name || p.name).split(/\s+/)[0],
    ]),
  )
  const why = searchParams.why && searchParams.why in APPROVE_WORDS ? (searchParams.why as ApproveCode) : null
  const at = searchParams.at && /^\d{1,2}:\d{2}\s?[AP]M$/i.test(searchParams.at) ? searchParams.at : null
  const me = ctx.user.email.toLowerCase()
  const mineOnNewest = state.kind === "ok" && state.approvals.some((a) => a.version_id === state.newest.id && a.email === me)

  return (
    <main className="cs-main">
      <Link href={`/client/projects/${found.p.slug}`} className="cs-back">
        <ChevronLeft size={16} /> {found.p.name}
      </Link>
      <p className="cs-eyebrow" style={{ marginTop: 12 }}>
        {film.name}
      </p>
      {state.kind === "ok" ? (
        <>
          <h1 className="cs-title">
            Version {state.newest.n}
            {film.version_label ? <span className="cs-lede"> · {film.version_label}</span> : null}
          </h1>
          <p className="cs-lede">{posted(state.newest.posted_at) ? `Posted ${posted(state.newest.posted_at)}` : null}</p>
        </>
      ) : (
        <h1 className="cs-title">{film.name}</h1>
      )}

      {why ? (
        <div className="cs-card cs-pad" role="alert" style={{ marginTop: 16 }}>
          <p>{why === "newer" && at ? `A newer cut was posted at ${at}. Watch it first.` : APPROVE_WORDS[why]}</p>
        </div>
      ) : null}

      <section className="cs-section">
        {state.kind === "ok" ? (
          <ReviewPlayer src={stream} title={`${film.name} · version ${state.newest.n}`} reviewUrl={film.review_url} />
        ) : state.kind === "error" ? (
          <div className="cs-card cs-pad">
            <p>{state.words}</p>
          </div>
        ) : null}
        <p style={{ marginTop: 12 }}>
          <a className="cs-btn ghost" href={film.review_url} target="_blank" rel="noopener">
            Watch and comment in Review
          </a>
        </p>
      </section>

      {state.kind === "ok" && film.ask === "ok" ? (
        <section className="cs-section">
          {state.newestApproved ? (
            <div className="cs-card cs-pad">
              <span className="cs-pill done">Approved</span>
              <p style={{ marginTop: 8 }}>Version {state.newest.n} is approved. Thank you.</p>
            </div>
          ) : approver && !mineOnNewest ? (
            <form method="post" action="/client/review/approve" className="cs-card cs-pad">
              <input type="hidden" name="film_id" value={film.id} />
              <input type="hidden" name="version_id" value={state.newest.id} />
              <label className="cs-field">
                <span>A note for Sam (optional)</span>
                <textarea name="note" rows={2} maxLength={1000} />
              </label>
              <button className="cs-btn" style={{ marginTop: 12 }}>
                Approve version {state.newest.n}
              </button>
              <p className="cs-lede" style={{ marginTop: 8, fontSize: 14 }}>
                Your approval is recorded with the date and this exact version.
              </p>
            </form>
          ) : (
            <div className="cs-card cs-pad">
              <p>
                {mineOnNewest
                  ? "You've approved this version."
                  : `Waiting for ${approvers.map((e) => names.get(e) ?? "the approver").join(film.approval === "all" ? " and " : " or ")} to approve.`}
              </p>
            </div>
          )}
        </section>
      ) : null}

      {state.kind !== "none" && state.approvals.length ? (
        <section className="cs-section">
          <div className="cs-rows">
            {state.approvals.map((a) => (
              <Link key={a.id} href={`/client/approvals/${a.id}`} className="cs-row">
                <span className="cs-row-main">
                  Approved by {a.name} · version {a.version_n}
                </span>
                <span className="cs-status">{day(a.at, { month: "short", day: "numeric" })}</span>
              </Link>
            ))}
          </div>
        </section>
      ) : null}
    </main>
  )
}
