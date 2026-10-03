import { NextResponse } from "next/server"
import { getClientContext } from "@/lib/client/context"
import { receipt } from "@/lib/client/sign"

export const dynamic = "force-dynamic"

// The signed copy of something THIS person signed (Sign Here contract v2: the viewer goes in a header and the engine
// checks it's the signer; we never pass anyone else's email). The engine's dated-receipt headers ride along.
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const ctx = await getClientContext()
  if (!ctx || ctx.viewing) return new NextResponse(null, { status: 404 })
  const res = await receipt(params.id, ctx.org.slug, ctx.user.email)
  if (!res?.body) return new NextResponse("Not available right now.", { status: 404 })
  const headers: Record<string, string> = {
    "Content-Type": "application/pdf",
    "Content-Disposition": `inline; filename="signed-${params.id.replace(/[^A-Za-z0-9_-]/g, "")}.pdf"`,
    "Cache-Control": "private, no-store",
  }
  for (const h of ["X-Sign-Signed-At", "X-Sign-Sha256"]) {
    const v = res.headers.get(h)
    if (v) headers[h] = v
  }
  return new NextResponse(res.body, { headers })
}
