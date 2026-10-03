// RETIRED. This was the Bible → Portal publish endpoint: it upserted 15 tables keyed by source_bible_id behind a
// static PUBLISH_SECRET. The Bible was retired 9/28/26 ("never revived"), and the client site's own sync and gate
// (lib/client/sync.ts, scripts/client_gate.py) are the only writers now. A second, differently-keyed writer could
// duplicate people and projects (Fable review of the migration plan, 10/3/26), so it answers 410 to everything.
// Safe to delete this file (and scripts/publish.ts) whenever someone with delete rights tidies up.
import { NextResponse } from "next/server"

const gone = () =>
  NextResponse.json({ error: "Retired: the Bible → Portal publish path is gone (the Bible was retired 9/28/26)." }, { status: 410 })

export const POST = gone
export const GET = gone
export const dynamic = "force-dynamic"
