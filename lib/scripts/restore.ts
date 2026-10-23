// Restore as a MINIMAL change (SPEC §14 v4 #13): the Yjs update that turns the live document into what an old version
// said, made by y-tiptap's updateYFragment (a structural diff), so rows nobody changed keep their Yjs items (comment
// anchors on them survive). Server and tests; no I/O.
import * as Y from "yjs"
import { updateYFragment } from "@tiptap/y-tiptap"
import { YFRAGMENT, pmFromYDoc } from "./doc"
import { mirrorNodeMarks } from "./marks"

/** The update (made under a fresh Yjs session, returned with its clientID) that makes `live` say what `oldState` said. */
export function restoreUpdate(live: Y.Doc, oldState: Uint8Array): { update: Uint8Array; clientId: number } {
  const old = new Y.Doc({ gc: true })
  Y.applyUpdate(old, oldState)
  const target = mirrorNodeMarks(pmFromYDoc(old))
  const scratch = new Y.Doc({ gc: true })
  Y.applyUpdate(scratch, Y.encodeStateAsUpdate(live))
  const before = Y.encodeStateVector(scratch)
  scratch.transact(() => updateYFragment(scratch, scratch.getXmlFragment(YFRAGMENT), target, { mapping: new Map(), isOMark: new Map() }))
  return { update: Y.encodeStateAsUpdate(scratch, before), clientId: scratch.clientID }
}
