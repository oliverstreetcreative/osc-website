import type { MetadataRoute } from "next"
import { IS_STAGING } from "@/lib/site-env"

// The only robots.txt source (the old /public/robots.txt was removed).
// Production: identical to the old static file. Staging: closed. middleware.ts
// also answers /robots.txt on staging and stamps X-Robots-Tag on every response.
export default function robots(): MetadataRoute.Robots {
  if (IS_STAGING) {
    return { rules: { userAgent: "*", disallow: "/" } }
  }
  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: "https://oliverstreetcreative.com/sitemap.xml",
  }
}
