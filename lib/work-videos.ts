// Standalone portfolio video pages (/work/<slug>).
// Same Mux embeds as the homepage portfolio band — keep the two in sync.

export interface WorkVideo {
  slug: string
  title: string
  client: string
  clientName: string
  clientLogo: string
  isLightLogo?: boolean
  embedSrc: string
  thumbnail: string
  description: string
}

export const WORK_VIDEOS: WorkVideo[] = [
  {
    slug: "phoenixs-story",
    title: "Phoenix's Story",
    client: "Learning Grove, Gala Event 2025",
    clientName: "Learning Grove",
    clientLogo: "/client-logos/learning-grove-logo.png",
    embedSrc:
      "https://player.mux.com/WZrdYK8rOVRBNHzfmMCa7MAYrSdPTBtK02Oiof01U028zM?thumbnail_time=147&thumbnail_url=https%3A%2F%2Fimage.mux.com%2FWZrdYK8rOVRBNHzfmMCa7MAYrSdPTBtK02Oiof01U028zM%2Fthumbnail.webp%3Fwidth%3D1920%26time%3D147&poster=https%3A%2F%2Fimage.mux.com%2FWZrdYK8rOVRBNHzfmMCa7MAYrSdPTBtK02Oiof01U028zM%2Fthumbnail.webp%3Fwidth%3D1920%26time%3D147",
    thumbnail:
      "https://image.mux.com/WZrdYK8rOVRBNHzfmMCa7MAYrSdPTBtK02Oiof01U028zM/thumbnail.webp?width=1920&time=147",
    description:
      "A fundraising story film for Learning Grove, premiered at their 2025 gala.",
  },
  {
    slug: "boone-county-2025",
    title: "2025 End-of-Year Report",
    client: "Boone County Prosecutors' Office",
    clientName: "Boone County Prosecutors' Office",
    clientLogo: "/client-logos/boone-county-logo-white-text.png",
    isLightLogo: true,
    embedSrc:
      "https://player.mux.com/IhCzSQ9YtLEvyAYYDfVBtob5cTIoUWR93LYRXYJ02uT8?thumbnail_time=104&thumbnail_url=https%3A%2F%2Fimage.mux.com%2FIhCzSQ9YtLEvyAYYDfVBtob5cTIoUWR93LYRXYJ02uT8%2Fthumbnail.webp%3Fwidth%3D1920%26time%3D104&poster=https%3A%2F%2Fimage.mux.com%2FIhCzSQ9YtLEvyAYYDfVBtob5cTIoUWR93LYRXYJ02uT8%2Fthumbnail.webp%3Fwidth%3D1920%26time%3D104",
    thumbnail:
      "https://image.mux.com/IhCzSQ9YtLEvyAYYDfVBtob5cTIoUWR93LYRXYJ02uT8/thumbnail.webp?width=1920&time=104",
    description:
      "An end-of-year report film for the Boone County Prosecutors' Office.",
  },
  {
    slug: "janells-story",
    title: "Janell's Story",
    client: "Beech Acres, Love Grows Here Event 2024",
    clientName: "Beech Acres",
    clientLogo: "/client-logos/beech-acres-logo.png",
    embedSrc:
      "https://player.mux.com/cmaTQdFokL801czQtX01YSxMgOX02E02LbVLHPVcudwY01Co?accent-color=%23E07830&thumbnail_time=238&thumbnail_url=https%3A%2F%2Fimage.mux.com%2FcmaTQdFokL801czQtX01YSxMgOX02E02LbVLHPVcudwY01Co%2Fthumbnail.webp%3Fwidth%3D1920%26time%3D238&poster=https%3A%2F%2Fimage.mux.com%2FcmaTQdFokL801czQtX01YSxMgOX02E02LbVLHPVcudwY01Co%2Fthumbnail.webp%3Fwidth%3D1920%26time%3D238",
    thumbnail:
      "https://image.mux.com/cmaTQdFokL801czQtX01YSxMgOX02E02LbVLHPVcudwY01Co/thumbnail.webp?width=1920&time=238",
    description:
      "A story film for Beech Acres Parenting Center, premiered at the 2024 Love Grows Here breakfast.",
  },
]

export function getWorkVideo(slug: string): WorkVideo | undefined {
  return WORK_VIDEOS.find((v) => v.slug === slug)
}
