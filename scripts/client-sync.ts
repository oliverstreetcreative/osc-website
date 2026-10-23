// Sync client books → Postgres from the command line.
//   DATABASE_URL=... DROPBOX_LOCAL_ROOT="$HOME/Dropbox/OLIVER STREET CREATIVE" npx tsx scripts/client-sync.ts
import { syncBooks } from "../lib/client/sync"

syncBooks()
  .then((r) => {
    console.log(JSON.stringify(r, null, 2))
    process.exit(r.failed.length ? 1 : 0)
  })
  .catch((e) => {
    console.error(e)
    process.exit(2)
  })
