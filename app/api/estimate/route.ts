import { NextResponse } from "next/server"
import { IS_STAGING } from "@/lib/site-env"
import { estimate, parseInput } from "@/lib/estimator/pricing"

// POST /api/estimate - the price estimator's only door to the formula.
// The page sends the visitor's choices; this sends back a range and nothing
// else (no line items, no rates). Staging-only until Sam approves the tool.
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
  return NextResponse.json(estimate(parseInput(body)), {
    headers: { "cache-control": "no-store" },
  })
}
