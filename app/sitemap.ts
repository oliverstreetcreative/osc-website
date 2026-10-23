import type { MetadataRoute } from "next"
import { WORK_VIDEOS } from "@/lib/work-videos"
import { faqIsUp } from "@/lib/faq"

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = "https://oliverstreetcreative.com"

  return [
    // /faq joins the sitemap only once it's up on the live site (Sam approved it, with answers: lib/faq.ts)
    ...(faqIsUp({ production: true })
      ? [{ url: `${baseUrl}/faq`, lastModified: new Date(), changeFrequency: "monthly" as const, priority: 0.6 }]
      : []),
    {
      url: `${baseUrl}/work`,
      lastModified: new Date(),
      changeFrequency: "monthly" as const,
      priority: 0.8,
    },
    ...WORK_VIDEOS.map((v) => ({
      url: `${baseUrl}/work/${v.slug}`,
      lastModified: new Date(),
      changeFrequency: "yearly" as const,
      priority: 0.7,
    })),
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 1,
    },
    {
      url: `${baseUrl}/join-our-crew`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/casting`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/locations`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.8,
    },
  ]
}
