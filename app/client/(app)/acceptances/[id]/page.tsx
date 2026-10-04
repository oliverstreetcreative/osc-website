// /client/acceptances/<id>: the receipt for a client's yes to a proposal (SPEC §24 v2). Frozen: the proposal's title,
// the exact file (its fingerprint, and the frozen copy itself), who, their org and role, when (Eastern). No price on
// the screen: the PDF is the record of the numbers. Listed in Documents for the people who see proposals.
import Link from "next/link"
import { notFound } from "next/navigation"
import { ChevronLeft } from "lucide-react"
import { requireClientContext } from "@/lib/client/context"
import { roleIn, seesProposals } from "@/lib/client/proposals"
import { db } from "@/lib/db"
import { HelpFooter, OSC_SMS } from "@/app/client/ui"

export const metadata = { title: "Accepted" }

export default async function AcceptanceReceipt({ params }: { params: { id: string } }) {
  const ctx = await requireClientContext()
  if (!/^[0-9a-f-]{36}$/i.test(params.id)) notFound()
  const a = await db.proposalAcceptance.findFirst({
    where: { id: params.id, organization_id: { in: ctx.orgs.map((o) => o.id) } },
    include: { document: { select: { id: true, project: { select: { name: true, slug: true } } } } },
  })
  if (!a) notFound()
  const role = await roleIn(ctx, a.organization_id)
  if (!role || !seesProposals(role)) notFound()
  const when = a.accepted_at.toLocaleString("en-US", {
    timeZone: "America/New_York",
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  })
  const project = a.document.project

  return (
    <main className="cs-main">
      {project?.slug ? (
        <Link href={`/client/projects/${project.slug}`} className="cs-back">
          <ChevronLeft size={16} /> {project.name}
        </Link>
      ) : null}
      <p className="cs-eyebrow" style={{ marginTop: 12 }}>
        Accepted
      </p>
      <h1 className="cs-title">{a.title}</h1>
      <div className="cs-card cs-pad" style={{ marginTop: 16 }}>
        <dl className="cs-receipt">
          <dt>Proposal</dt>
          <dd>
            <a className="cs-link" href={`/client/proposals/${a.document.id}/file?v=${a.sha256.slice(0, 8)}`} target="_blank" rel="noopener">
              {a.title} (PDF)
            </a>
          </dd>
          <dt>File</dt>
          <dd>Fingerprint {a.sha256.slice(0, 8)}</dd>
          <dt>Accepted by</dt>
          <dd>
            {a.name} · {a.org_name}
          </dd>
          <dt>When</dt>
          <dd>{when}</dd>
          {a.withdrawn_at ? (
            <>
              <dt>Status</dt>
              <dd>Withdrawn {a.withdrawn_at.toLocaleDateString("en-US", { timeZone: "America/New_York" })}</dd>
            </>
          ) : null}
        </dl>
      </div>
      <p className="cs-lede" style={{ marginTop: 12, fontSize: 14 }}>
        This records a yes to this exact proposal file. Oliver Street Creative keeps a copy. Questions? <a className="cs-link" href={OSC_SMS}>Text Sam</a>.
      </p>
      <HelpFooter />
    </main>
  )
}
