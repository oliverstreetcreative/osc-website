import type { ReactNode } from "react"
import Link from "next/link"
import { SiteFrame, SectionHead } from "@/components/site/SiteFrame"

// Keep this frame on the server so the logo preview follows the build's
// staging gate; SurveyRenderer remains the interactive child.
export function IntakeLayout({ children, title, subtitle }: { children: ReactNode; title: string; subtitle: string }) {
  return (
    <SiteFrame>
      <section className="site-sec">
        <div className="site-in intake-system">
          <nav className="intake-system-nav" aria-label="Applications">
            <Link href="/join-our-crew">Crew</Link>
            <Link href="/casting">Casting</Link>
            <Link href="/locations">Locations</Link>
          </nav>
          <SectionHead as="h1" title={title} lede={subtitle} />
          <div className="intake-system-form">{children}</div>
        </div>
      </section>
    </SiteFrame>
  )
}
