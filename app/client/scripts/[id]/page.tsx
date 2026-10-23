// /client/scripts/<id>: one script, live (SPEC §14). Outside the portal's (app) shell on purpose: an invitee lands on
// the script, not the portal (phone moment 2), and OSC staff edit here directly.
import type { Metadata } from "next"
import { notFound, redirect } from "next/navigation"
import { db } from "@/lib/db"
import { roleOf, sessionFacts, UUID } from "@/lib/scripts/server/access"
import { personCode } from "@/lib/scripts/marks"
import { Wordmark } from "@/app/client/ui"
import { ScriptEditor } from "./editor"
import "../scripts.css"
import { ReportLink, ReportSheet } from "@/app/client/report-sheet"

export const dynamic = "force-dynamic"
export const metadata: Metadata = { title: "Script" }

export default async function ScriptPage({ params }: { params: { id: string } }) {
  const id = params.id
  if (!UUID.test(id)) notFound()
  const facts = await sessionFacts()
  if (!facts) redirect(`/login?redirect=${encodeURIComponent(`/client/scripts/${id}`)}`)
  const access = await roleOf(id, facts)
  if (!access) notFound()
  const script = await db.script.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      job: true,
      reader: true,
      target_seconds: true,
      pace_wpm: true,
      organization_id: true,
      source: true,
      status: true,
      approvers: true,
      approval: true,
      organization: { select: { name: true, short_name: true } },
    },
  })
  if (!script) notFound()

  // First names for "Sam suggested…": everyone who has worked on it or has access, and OSC staff.
  const ids = new Set<string>()
  const clients = await db.scriptClient.findMany({ where: { script_id: id }, select: { person_id: true } })
  for (const c of clients) ids.add(c.person_id)
  const shared = await db.scriptAccess.findMany({ where: { script_id: id, person_id: { not: null } }, select: { person_id: true } })
  for (const a of shared) if (a.person_id) ids.add(a.person_id)
  const persons = await db.person.findMany({
    where: { OR: [{ id: { in: [...ids] } }, { is_staff: true }] },
    select: { id: true, name: true, first_name: true },
  })
  const people = Object.fromEntries(persons.map((p) => [personCode(p.id), (p.first_name || p.name || "Someone").trim().split(/\s+/)[0]]))
  const org = script.organization ? script.organization.short_name ?? script.organization.name : "Oliver Street Creative"

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
        <p className="cs-eyebrow">
          {org}
          {script.job ? ` · ${script.job}` : ""}
          {script.reader ? ` · read by ${script.reader}` : ""}
        </p>
        <h1 className="cs-title sc-title">{script.title}</h1>
        {access.readOnly ? <p className="sc-note">{access.readOnly}</p> : null}
        <ScriptEditor
          scriptId={script.id}
          meCode={facts.person.code}
          people={people}
          targetS={script.target_seconds}
          paceWpm={script.pace_wpm}
          clientsWords={!!script.organization_id || script.source !== null}
          staff={facts.staff}
          settings={{
            status: script.status,
            target_seconds: script.target_seconds,
            approvers: Array.isArray(script.approvers) ? script.approvers.filter((e): e is string => typeof e === "string") : [],
            approval: script.approval,
          }}
        />
      </main>
      {/* "Something's wrong?" (SPEC §29 v2): Scripts has its own chrome, so it carries its own link and sheet. */}
      <p className="cs-report-foot">
        <ReportLink />
      </p>
      <ReportSheet followLink={false} />
    </div>
  )
}
