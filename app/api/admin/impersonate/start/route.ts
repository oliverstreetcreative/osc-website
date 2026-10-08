// RETIRED (client-website SPEC §27 P0 v2): the older admin impersonation swapped the signed-in identity on a
// domain-wide cookie. "View as client" (/client/view-as) is the one staff view now: read-only, logged, host-only.
// This stub answers 410 until the file is deleted (a git rm needs Sam's shell).
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export function POST() {
  return NextResponse.json({ error: 'Retired: use View as client' }, { status: 410 })
}
