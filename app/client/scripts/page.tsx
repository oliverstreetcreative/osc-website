// /client/scripts: the scripts this person can open (SPEC §14). OSC staff see every script; anyone else sees the
// scripts shared with them or their organization (not revoked, not expired, shared by Sam).
import type { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"
import { db } from "@/lib/db"
import { sessionFacts } from "@/lib/scripts/server/access"
import { Wordmark } from "@/app/client/ui"
import "./scripts.css"
import { ReportLink, ReportSheet } from "@/app/client/report-sheet"

export const dynamic = "force-dynamic"
export const metadata: Metadata = { title: "Scripts" }

export default async function ScriptsPage() {
  const facts = await sessionFacts()
  if (!facts) redirect(`/login?redirect=${encodeURIComponent("/client/scripts")}`)
  // A script invite's session opens its own script and nothing else (SPEC §27 P0 v2): never the list.
  if (facts.scopeScriptId) redirect(`/client/scripts/${facts.scopeScriptId}`)
  const select = {
    id: true,
    title: true,
    job: true,
    read_only: true,
    updated_at: true,
    target_seconds: true,
    organization: { select: { name: true, short_name: true } },
  } as const
  let scripts
  if (facts.staff) {
    scripts = await db.script.findMany({ where: { archived_at: null }, orderBy: [{ job: "desc" }, { title: "asc" }], select })
  } else {
    const orgIds = (await db.membership.findMany({ where: { person_id: facts.person.id, hidden: false }, select: { organization_id: true } })).map(
      (m) => m.organization_id,
    )
    const now = new Date()
    scripts = await db.script.findMany({
      where: {
        archived_at: null,
        audience: { not: "office" },
        access: {
          some: {
            revoked_at: null,
            AND: [
              { OR: [{ person_id: facts.person.id }, ...(orgIds.length ? [{ organization_id: { in: orgIds } }] : [])] },
              { OR: [{ expires_at: null }, { expires_at: { gt: now } }] },
            ],
          },
        },
      },
      orderBy: [{ job: "desc" }, { title: "asc" }],
      select,
    })
  }

  return (
    <div className="sc-page">
      <header className="cs-top">
        <div className="cs-top-in">
          <a href={facts.staff ? "/admin" : "/client"} aria-label="Oliver Street Creative">
            <Wordmark />
          </a>
        </div>
      </header>
      <main className="cs-main sc-main">
        <h1 className="cs-title">Scripts</h1>
        {!scripts.length ? (
          <p className="cs-lede">No scripts shared with you yet.</p>
        ) : (
          <div className="cs-rows sc-list" style={{ marginTop: 16 }}>
            {scripts.map((s) => (
              <Link key={s.id} href={`/client/scripts/${s.id}`} className="cs-row">
                <span className="cs-row-main">
                  <b>{s.title}</b>
                  <br />
                  <span className="sc-list-meta">
                    {s.organization ? s.organization.short_name ?? s.organization.name : "Oliver Street Creative"}
                    {s.job ? ` · ${s.job}` : ""}
                    {s.target_seconds ? ` · :${s.target_seconds}` : ""}
                  </span>
                </span>
                {s.read_only ? <span className="cs-pill">Read only</span> : null}
              </Link>
            ))}
          </div>
        )}
      </main>
      {/* "Something's wrong?" (SPEC §29 v2): Scripts has its own chrome, so it carries its own link and sheet. */}
      <p className="cs-report-foot">
        <ReportLink />
      </p>
      <ReportSheet followLink={false} />
    </div>
  )
}
