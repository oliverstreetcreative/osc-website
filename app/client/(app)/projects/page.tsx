import { requireClientContext } from "@/lib/client/context"
import { orgProjects } from "@/lib/client/data"
import { canRequest, openRequests } from "@/lib/client/requests"
import { currentDraft } from "@/lib/client/request-drafts"
import { ProjectCard } from "@/app/client/project-card"
import { HelpFooter } from "@/app/client/ui"
import { RequestList, StartCard } from "@/app/client/start-cards"

export const metadata = { title: "Projects" }

export default async function Projects() {
  const ctx = await requireClientContext()
  const [projects, requests, draft] = await Promise.all([
    orgProjects(ctx.org.id),
    openRequests(ctx.org.id),
    canRequest(ctx) ? currentDraft(ctx) : Promise.resolve(null),
  ])
  const orgName = ctx.org.short_name ?? ctx.org.name
  return (
    <main className="cs-main">
      <p className="cs-eyebrow">{ctx.org.name}</p>
      <h1 className="cs-title" style={{ marginTop: 6 }}>Projects</h1>
      {/* SPEC §31 v2: a sent request is a project in Quote until Sam's project arrives. */}
      <RequestList requests={requests} orgName={orgName} logo={ctx.org.logo_path} />
      {projects.length ? (
        <section className="cs-section" style={{ marginTop: 24 }}>
          <div className="cs-grid">{projects.map((p) => <ProjectCard key={p.id} p={p} orgName={orgName} logo={ctx.org.logo_path} />)}</div>
        </section>
      ) : !requests.length ? (
        <section className="cs-section" style={{ marginTop: 24 }}>
          <div className="cs-card cs-empty"><b>No projects yet.</b></div>
        </section>
      ) : null}
      <StartCard ctx={ctx} hasProjects={projects.length > 0 || requests.length > 0} draft={draft} />
      <HelpFooter />
    </main>
  )
}
