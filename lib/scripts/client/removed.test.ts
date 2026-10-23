// Built review #2: words typed into a row that someone else's change removes at the same moment are caught.
// Run: node --conditions=import --import tsx --test lib/scripts/client/removed.test.ts
import { test } from "node:test"
import assert from "node:assert/strict"
import * as Y from "yjs"
import { TypingClock, wordsRemoved } from "./removed"

function twoRows() {
  const server = new Y.Doc()
  const frag = server.getXmlFragment("default")
  const row = (words: string) => {
    const el = new Y.XmlElement("avRow")
    const p = new Y.XmlElement("paragraph")
    const t = new Y.XmlText()
    t.insert(0, words)
    p.insert(0, [t])
    el.insert(0, [p])
    return el
  }
  frag.insert(0, [row("First row."), row("Second row.")])
  return server
}

test("my words in a row someone else removes are handed back; theirs and old ones are not", () => {
  const server = twoRows()
  const mike = new Y.Doc()
  Y.applyUpdate(mike, Y.encodeStateAsUpdate(server))
  const typing = new TypingClock(mike)
  const sam = new Y.Doc()
  Y.applyUpdate(sam, Y.encodeStateAsUpdate(server))

  // Mike types in the second row (not yet seen by Sam)
  const secondText = () => ((mike.getXmlFragment("default").get(1) as Y.XmlElement).get(0) as Y.XmlElement).get(0) as Y.XmlText
  secondText().insert(0, "Really, ")
  typing.note()
  // Sam removes the second row at the same moment (a restore, or accepting its deletion)
  const sv = Y.encodeStateVector(sam)
  sam.getXmlFragment("default").delete(1, 1)
  const samsChange = Y.encodeStateAsUpdate(sam, sv)

  let caught = ""
  const remote = Symbol("server")
  mike.on("afterTransaction", (tr: Y.Transaction) => {
    if (tr.origin === remote) caught += wordsRemoved(tr, mike.clientID, typing.since(60_000))
  })
  // Mike's own words reached the server first: Sam's delete removes them too once both merge on Mike's phone
  Y.applyUpdate(sam, Y.encodeStateAsUpdate(mike, Y.encodeStateVector(sam)))
  Y.applyUpdate(mike, samsChange, remote)
  assert.equal(caught, "Really,")
})

test("an old word of mine removed later is an intended change, not a hand-back", () => {
  const server = twoRows()
  const mike = new Y.Doc()
  Y.applyUpdate(mike, Y.encodeStateAsUpdate(server))
  const typing = new TypingClock(mike)
  const t = ((mike.getXmlFragment("default").get(0) as Y.XmlElement).get(0) as Y.XmlElement).get(0) as Y.XmlText
  t.insert(0, "Old ")
  typing.note()
  // pretend that was long ago: everything typed so far is older than the window
  const since = Y.getState(mike.store, mike.clientID)
  const sam = new Y.Doc()
  Y.applyUpdate(sam, Y.encodeStateAsUpdate(mike))
  const sv = Y.encodeStateVector(sam)
  sam.getXmlFragment("default").delete(0, 1)
  let caught = ""
  const remote = Symbol("server")
  mike.on("afterTransaction", (tr: Y.Transaction) => {
    if (tr.origin === remote) caught += wordsRemoved(tr, mike.clientID, since)
  })
  Y.applyUpdate(mike, Y.encodeStateAsUpdate(sam, sv), remote)
  assert.equal(caught, "")
})
