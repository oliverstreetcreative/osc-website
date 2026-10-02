import { NextResponse } from "next/server"
import { deskAllowed } from "@/lib/estimator/desk-auth"
import { parseAnswers, parseEdits, quote } from "@/lib/estimator/engine"

// POST /api/quote-desk - the DETAILED quote (internal). Same engine as the
// public range; returns every line, every parameter and what's overridden.
// Gated by lib/estimator/desk-auth.ts: 404 to anyone not allowed.
export async function POST(req: Request) {
  if (!(await deskAllowed())) return NextResponse.json({ error: "not found" }, { status: 404 })
  let body: Record<string, unknown> = {}
  try {
    body = await req.json()
  } catch {
    // defaults
  }
  const q = quote(parseAnswers(body.answers), parseEdits(body.edits))
  return NextResponse.json(q, { headers: { "cache-control": "no-store" } })
}
