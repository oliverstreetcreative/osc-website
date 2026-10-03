import { NextResponse } from "next/server"
import { getClientContext } from "@/lib/client/context"
import { receipt } from "@/lib/client/sign"

export const dynamic = "force-dynamic"

// The signed copy of something THIS person signed. The engine checks that
// for_email is the signer; we never pass anyone else's email.
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const ctx = await getClientContext()
  if (!ctx || ctx.viewing) return new NextResponse(null, { status: 404 })
  const res = await receipt(params.id, ctx.user.email)
  if (!res?.body) return new NextResponse("Not available right now.", { status: 404 })
  return new NextResponse(res.body, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="signed-${params.id}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  })
}
