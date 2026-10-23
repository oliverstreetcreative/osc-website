import type { Metadata } from "next"
import { WORK_VIDEOS } from "@/lib/work-videos"
import { SiteFrame, SectionHead } from "@/components/site/SiteFrame"
import { TalkCard, WorkCards } from "@/components/site/WorkCards"

// /work: the public portfolio in one place (the nav's "Work"). Three films, no
// more (lib/work-videos.ts); everything else is "by request". Added 10/3/26 with
// the hub-vein restyle.

export const metadata: Metadata = {
  title: "Work | Oliver Street Creative",
  description: "A few of the films we’ve made: fundraising story films and a year-end report.",
  alternates: { canonical: "https://oliverstreetcreative.com/work" },
}

export default function WorkIndexPage() {
  return (
    <SiteFrame current="work">
      <section className="site-sec">
        <div className="site-in">
          <SectionHead as="h1" eyebrow="Work" title="Some of our work." lede={<>A few of the films we&rsquo;ve made.</>} />
          <WorkCards videos={WORK_VIDEOS} describe heading="h2" />
          <p className="site-more">
            <a className="site-link" href="/#contact">
              More sample work available by request
            </a>
            .
          </p>
          <TalkCard />
        </div>
      </section>
    </SiteFrame>
  )
}
