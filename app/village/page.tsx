import type { Metadata } from "next"
import { VillagePlayer } from "./village-player"

export const metadata: Metadata = {
  title: "The Village — Live",
  description: "Live stream from The Village.",
  robots: { index: false, follow: false },
  alternates: {
    canonical: "https://village.oliverstreetcreative.com/",
  },
  openGraph: {
    title: "The Village — Live",
    description: "Live stream from The Village.",
    url: "https://village.oliverstreetcreative.com/",
    siteName: "Oliver Street Creative",
    type: "video.other",
  },
}

export default function VillagePage() {
  return <VillagePlayer />
}
