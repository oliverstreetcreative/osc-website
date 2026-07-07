import type { Metadata } from "next"
import { VillagePlayer } from "./village-player"

export const metadata: Metadata = {
  title: "Video Village — Live",
  description: "Live stream from Video Village.",
  robots: { index: false, follow: false },
  alternates: {
    canonical: "https://village.oliverstreetcreative.com/",
  },
  openGraph: {
    title: "Video Village — Live",
    description: "Live stream from Video Village.",
    url: "https://village.oliverstreetcreative.com/",
    siteName: "Oliver Street Creative",
    type: "video.other",
  },
}

export default function VillagePage() {
  return <VillagePlayer />
}
