// /client/approvals/<id>: the receipt for an approval of record (SPEC §13 v3/v4). Frozen: what was approved (the
// exact Review version, with Sam's v-number), by whom, when (Eastern), and the note. Also listed in Documents.
import Link from "next/link"
import { notFound } from "next/navigation"
import { ChevronLeft } from "lucide-react"
import { requireClientContext } from "@/lib/client/context"
import { db } from "@/lib/db"

export const metadata = { title: "Approval" }

export default async function ApprovalReceipt({ params }: { params: { id: string } }) {
  const ctx = await requireClientContext()
  if (!/^[0-9a-f-]{36}$/i.test(params.id)) notFound()
  const a = await db.versionApproval.findFirst({
    where: { id: params.id, organization_id: { in: ctx.orgs.map((o) => o.id) } },
    include: { deliverable: { select: { project: { select: { name: true, slug: true } } } } },
  })
  if (!a) notFound()
  const when = a.approved_at.toLocaleString("en-US", {
    timeZone: "America/New_York",
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  })
  const project = a.deliverable.project

  return (
    <main className="cs-main">
      {project.slug ? (
        <Link href={`/client/projects/${project.slug}`} className="cs-back">
          <ChevronLeft size={16} /> {project.name}
        </Link>
      ) : null}
      <p className="cs-eyebrow" style={{ marginTop: 12 }}>
        Approval
      </p>
      <h1 className="cs-title">{a.film_title}</h1>
      <div className="cs-card cs-pad" style={{ marginTop: 16 }}>
        <dl className="cs-receipt">
          <dt>Version</dt>
          <dd>
            Version {a.review_version_n} in Review
            {a.version_label ? ` · ${a.version_label}` : ""}
          </dd>
          <dt>Approved by</dt>
          <dd>
            {a.name} · {a.org_name}
          </dd>
          <dt>When</dt>
          <dd>{when}</dd>
          {a.note ? (
            <>
              <dt>Note</dt>
              <dd>{a.note}</dd>
            </>
          ) : null}
          {a.withdrawn_at ? (
            <>
              <dt>Status</dt>
              <dd>Withdrawn {a.withdrawn_at.toLocaleDateString("en-US", { timeZone: "America/New_York" })}</dd>
            </>
          ) : null}
        </dl>
      </div>
      <p className="cs-lede" style={{ marginTop: 12, fontSize: 14 }}>
        This is the record of approval for this exact version. Oliver Street Creative keeps a copy.
      </p>
    </main>
  )
}
