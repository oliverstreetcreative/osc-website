import Link from "next/link"
import type { ProjectWithAll } from "@/lib/client/data"
import { day } from "@/lib/client/format"
import { PosterImage, PhasePill } from "./ui"

export function ProjectCard({ p, orgName, logo }: { p: ProjectWithAll; orgName: string; logo?: string | null }) {
  const line = p.next_step ?? p.status_line ?? p.summary
  return (
    <Link href={`/client/projects/${p.slug}`} className="cs-card cs-pcard">
      <div className="cs-poster">
        <PosterImage project={p} orgName={orgName} logo={logo} />
        {p.kind ? <span className="cs-poster-tag">{p.kind}</span> : null}
      </div>
      <div className="cs-pcard-body">
        <h3>{p.name}</h3>
        <div className="cs-pcard-meta">
          <PhasePill phase={p.phase} />
          {p.sort_date ? <span className="cs-status">{day(p.sort_date, { month: "short", year: "numeric" })}</span> : null}
        </div>
        {line ? <p>{line}</p> : null}
      </div>
    </Link>
  )
}
