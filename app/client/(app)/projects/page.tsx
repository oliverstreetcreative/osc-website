import { requireClientContext } from "@/lib/client/context"
import { orgProjects } from "@/lib/client/data"
import { openRequests } from "@/lib/client/requests"
import { ProjectCard } from "@/app/client/project-card"
import { HelpFooter } from "@/app/client/ui"
import { RequestCards, StartCard } from "@/app/client/start-cards"

export const metadata = { title: "Projects" }

export default async function Projects() {
  const ctx = await requireClientContext()
  const [projects, requests] = await Promise.all([orgProjects(ctx.org.id), openRequests(ctx.org.id)])
  const orgName = ctx.org.short_name ?? ctx.org.name
  return (
    <main className="cs-main">
      <p className="cs-eyebrow">{ctx.org.name}</p>
      <h1 className="cs-title" style={{ marginTop: 6 }}>Projects</h1>
      <RequestCards requests={requests} />
      <section className="cs-section" style={{ marginTop: 24 }}>
        {projects.length ? (
          <div className="cs-grid">{projects.map((p) => <ProjectCard key={p.id} p={p} orgName={orgName} logo={ctx.org.logo_path} />)}</div>
        ) : (
          <div className="cs-card cs-empty"><b>No projects yet.</b></div>
        )}
      </section>
      <StartCard ctx={ctx} />
      <HelpFooter />
    </main>
  )
}
