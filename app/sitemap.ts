import type { MetadataRoute } from "next"
import { WORK_VIDEOS } from "@/lib/work-videos"

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = "https://oliverstreetcreative.com"

  return [
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
