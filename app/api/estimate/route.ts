import { NextResponse } from "next/server"
import { IS_STAGING } from "@/lib/site-env"
import { parseAnswers, simpleRange } from "@/lib/estimator/engine"

// POST /api/estimate - the SIMPLE quote's only door to the formula.
// Takes the visitor's answers, returns a RANGE and nothing else: no total,
// no lines, no rates (Sam 10/2). Staging-only until Sam approves the tool.
export async function POST(req: Request) {
  if (!IS_STAGING && process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "not found" }, { status: 404 })
  }
  let body: unknown = {}
  try {
    body = await req.json()
  } catch {
    // empty or bad body -> defaults
  }
  const { low, high } = simpleRange(parseAnswers(body))
  return NextResponse.json({ low, high }, { headers: { "cache-control": "no-store" } })
}
