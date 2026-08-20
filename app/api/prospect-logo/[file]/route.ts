import { NextResponse } from "next/server"
import { getProspectLogo } from "@/lib/portfolio-data"

export const dynamic = "force-dynamic"

export async function GET(
  _req: Request,
  { params }: { params: { file: string } }
) {
  const logo = await getProspectLogo(params.file)
  if (!logo) return new NextResponse("Not found", { status: 404 })
  return new NextResponse(logo.body, {
    headers: {
      "Content-Type": logo.contentType,
      // Logos change rarely; let browsers and the edge hold them briefly.
      "Cache-Control": "public, max-age=300",
    },
  })
}
