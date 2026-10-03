import { requireClientContext } from "@/lib/client/context"
import { orgProjects } from "@/lib/client/data"
import { ProjectCard } from "../project-card"
import { HelpFooter } from "../ui"

export const metadata = { title: "Projects" }

export default async function Projects() {
  const ctx = await requireClientContext()
  const projects = await orgProjects(ctx.org.id)
  const orgName = ctx.org.short_name ?? ctx.org.name
  return (
    <main className="cs-main">
      <p className="cs-eyebrow">{ctx.org.name}</p>
      <h1 className="cs-title" style={{ marginTop: 6 }}>Projects</h1>
      <p className="cs-lede">Every film we&rsquo;ve made together, newest first.</p>
      <section className="cs-section" style={{ marginTop: 24 }}>
        {projects.length ? (
          <div className="cs-grid">{projects.map((p) => <ProjectCard key={p.id} p={p} orgName={orgName} logo={ctx.org.logo_path} />)}</div>
        ) : (
          <div className="cs-card cs-empty"><b>No projects yet.</b>When we start one, it shows up here.</div>
        )}
      </section>
      <HelpFooter />
    </main>
  )
}
