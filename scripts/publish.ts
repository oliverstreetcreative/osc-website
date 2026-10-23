// RETIRED (10/3/26). This script read the retired bible.db and POSTed it to /api/publish, a second writer to the
// portal database keyed differently from the client books. The Bible was retired 9/28/26 and the endpoint now answers
// 410. Kept only as a tombstone so nothing re-runs it by habit; safe to delete.
console.error("publish.ts is retired: the Bible was retired 9/28/26 and /api/publish answers 410.")
process.exit(1)
