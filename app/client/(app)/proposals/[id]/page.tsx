// /client/proposals/<document id>: read Sam's proposal and accept it (SPEC §24 v2). The PDF comes only from the gate's
// frozen copy (hash-checked); no price on this screen (the PDF carries Sam's numbers and their posture). Accept is a
// plain tap that records a yes to exactly this file; it builds nothing and promises no further step.
import Link from "next/link"
import { headers } from "next/headers"
import { notFound } from "next/navigation"
import { ChevronLeft, FileText } from "lucide-react"
import { requireClientContext } from "@/lib/client/context"
import { ACCEPT_WORDS, acceptorsOf, expired, findProposal, isAcceptCode, isAcceptor } from "@/lib/client/proposals"
import { isDemoSlug } from "@/lib/client/demo"
import { db } from "@/lib/db"
import { day, dayET } from "@/lib/client/format"
import { HelpFooter, OSC_SMS } from "@/app/client/ui"

export const metadata = { title: "Proposal" }

export default async function ProposalPage({ params, searchParams }: { params: { id: string }; searchParams: { why?: string } }) {
  const ctx = await requireClientContext()
  const found = await findProposal(ctx, params.id)
  if (!found) notFound()
  const { doc } = found
  const org = ctx.orgs.find((o) => o.id === doc.organization_id)
  const preview = (await headers()).get("x-user-preview") === "true"
  // A staging PREVIEW sign-in (the screenshot camera) sees the acceptor's real form with the button off; the POST
  // refuses preview sessions anyway.
  const readOnly = !!ctx.viewing || isDemoSlug(org?.slug)
  const acceptors = acceptorsOf(doc)
  const names = new Map(
    (await db.person.findMany({ where: { email: { in: acceptors } }, select: { email: true, name: true, first_name: true } })).map((p) => [
      p.email.toLowerCase(),
      (p.first_name || p.name).split(/\s+/)[0],
    ]),
  )
  const open = doc.ask === "accept" && !!doc.sha256 && !doc.acceptance
  const late = expired(doc.good_until)
  // The frozen copy; the demo's sample proposal (no frozen copy, never accepted) streams from its sample path.
  const fileUrl = doc.sha256
    ? `/client/proposals/${doc.id}/file?v=${doc.sha256.slice(0, 8)}`
    : isDemoSlug(org?.slug) && doc.dropbox_path
      ? `/client/proposals/${doc.id}/file`
      : null
  const why = isAcceptCode(searchParams.why) ? searchParams.why : null

  return (
    <main className="cs-main">
      {doc.project?.slug ? (
        <Link href={`/client/projects/${doc.project.slug}`} className="cs-back">
          <ChevronLeft size={16} /> {doc.project.name}
        </Link>
      ) : (
        <Link href="/client/documents" className="cs-back">
          <ChevronLeft size={16} /> Documents
        </Link>
      )}
      <p className="cs-eyebrow" style={{ marginTop: 12 }}>
        Proposal
      </p>
      <h1 className="cs-title">{doc.title}</h1>
      <p className="cs-lede">
        {[doc.dated_on ? `From Sam · ${day(doc.dated_on, { month: "short", day: "numeric" })}` : "From Sam", doc.good_until ? `Good until ${day(doc.good_until, { month: "short", day: "numeric" })}` : null]
          .filter(Boolean)
          .join(" · ")}
      </p>

      {why ? (
        <div className="cs-card cs-pad" role="alert" style={{ marginTop: 16 }}>
          <p>{ACCEPT_WORDS[why]}</p>
        </div>
      ) : null}

      <section className="cs-section">
        {fileUrl ? (
          <>
            <a className="cs-btn" href={fileUrl} target="_blank" rel="noopener" style={{ width: "100%" }}>
              <FileText size={16} style={{ verticalAlign: -3, marginRight: 6 }} />
              Read the proposal
            </a>
            <iframe className="cs-pdf" src={fileUrl} title={doc.title} />
          </>
        ) : (
          <div className="cs-card cs-pad">
            <p>The proposal file isn&rsquo;t available right now. Text Sam.</p>
          </div>
        )}
      </section>

      <section className="cs-section">
        {doc.acceptance ? (
          <div className="cs-card cs-pad">
            <span className="cs-pill done">Accepted</span>
            <p style={{ marginTop: 8 }}>
              Accepted by {doc.acceptance.name} · {dayET(doc.acceptance.accepted_at, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
            </p>
            <p style={{ marginTop: 8 }}>
              <Link className="cs-link" href={`/client/acceptances/${doc.acceptance.id}`}>
                See the receipt
              </Link>
            </p>
          </div>
        ) : !open ? null : late ? (
          <div className="cs-card cs-pad">
            <p>
              This proposal has expired. <a className="cs-link" href={OSC_SMS}>Text Sam</a>.
            </p>
          </div>
        ) : !readOnly && isAcceptor(doc, ctx.user.email) ? (
          <form method="post" action="/client/proposals/accept" className="cs-card cs-pad">
            <input type="hidden" name="document_id" value={doc.id} />
            <input type="hidden" name="sha256" value={doc.sha256!} />
            <button className="cs-btn" style={{ width: "100%" }} disabled={preview}>
              Accept this proposal
            </button>
            <p className="cs-lede" style={{ marginTop: 8, fontSize: 14 }}>
              {preview ? (
                "Preview sign-in: the button is off."
              ) : (
                <>
                  Accepting tells Sam yes to this proposal as written. Questions first? <a className="cs-link" href={OSC_SMS}>Text Sam</a>.
                </>
              )}
            </p>
          </form>
        ) : (
          <div className="cs-card cs-pad">
            <p>
              {readOnly
                ? "Read-only here."
                : `Waiting for ${acceptors.map((e) => names.get(e) ?? "the person Sam named").join(" or ")} to accept.`}
            </p>
          </div>
        )}
      </section>
      <HelpFooter />
    </main>
  )
}
