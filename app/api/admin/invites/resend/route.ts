// RETIRED (client-website SPEC §27 P0 v2 #9): "Resend" revived a USED sign-in token for 7 days. A fresh link is the
// person asking on /login (with its limits, its device pairing and its code). This stub answers 410 until the file is
// deleted (a git rm needs Sam's shell).
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export function POST() {
  return NextResponse.json({ error: 'Retired: the person asks for a new link on the sign-in page' }, { status: 410 })
}
