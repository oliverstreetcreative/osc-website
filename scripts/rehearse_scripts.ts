// Rehearse SPEC §14's proof against STAGING, at the protocol level, with real sign-ins (client-website matter):
// a client SUGGESTER on two connections ("two phones") and a client EDITOR ("desktop") on the Harmon script. It drives
// the same library code the editor uses (suggest mode, accept, the sync protocol) and checks what every session sees.
// No secrets on disk: the two one-time sign-in tokens come as arguments and the sessions live only in memory.
//
//   node --conditions=import --import tsx scripts/rehearse_scripts.ts <base-url> <suggester email:code> <editor email:code> [report.md]
// Sign-in (SPEC §27 P0 v2): ask for each person's link, read the CODE from each email, pass email:code (a link signs
// in only the browser that asked for it, so a driver uses the code).
//
// Leaves the script as it found it (restores the imported version at the end; the rehearsal's versions and one
// resolved comment stay in history, labelled "Rehearsal").
import * as Y from "yjs"
import { writeFileSync } from "node:fs"
import { EditorState, type Transaction } from "@tiptap/pm/state"
import { updateYFragment } from "@tiptap/y-tiptap"
import { Awareness, applyAwarenessUpdate, encodeAwarenessUpdate } from "y-protocols/awareness"
import { YFRAGMENT, pmFromYDoc, cloneYDoc, prompterText, rowsOf, viewOf } from "../lib/scripts/doc"
import { mirrorNodeMarks } from "../lib/scripts/marks"
import { idGenerator, suggestEdit } from "../lib/scripts/normalize"
import { resolveSuggestions } from "../lib/scripts/resolve"
import { listSuggestions } from "../lib/scripts/suggestions"
import { scriptSchema } from "../lib/scripts/schema"

const [base, suggesterToken, editorToken, reportPath] = process.argv.slice(2)
if (!base || !suggesterToken || !editorToken) {
  console.error("usage: rehearse_scripts.ts <base-url> <suggester email:code> <editor email:code> [report.md]")
  process.exit(2)
}

const log: string[] = []
let failures = 0
function step(ok: boolean, what: string, detail = "") {
  const line = `${ok ? "PASS" : "FAIL"} ${what}${detail ? ` — ${detail}` : ""}`
  log.push(line)
  console.log(line)
  if (!ok) failures++
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
async function until(pred: () => boolean, ms = 8000) {
  const end = Date.now() + ms
  while (Date.now() < end) {
    if (pred()) return true
    await sleep(100)
  }
  return pred()
}
const b64 = (u: Uint8Array) => Buffer.from(u).toString("base64")
const fromB64 = (s: string) => new Uint8Array(Buffer.from(s, "base64"))

async function signIn(cred: string): Promise<string> {
  const i = cred.indexOf(":")
  const res = await fetch(`${base}/api/auth/code`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: base, referer: `${base}/login` },
    body: JSON.stringify({ email: cred.slice(0, i), code: cred.slice(i + 1) }),
  })
  const set = res.headers.get("set-cookie") ?? ""
  const m = /((?:__Host-)?osc_session)=([^;]+)/.exec(set)
  if (!res.ok || !m) throw new Error(`sign-in failed: ${res.status}`)
  return `${m[1]}=${m[2]}`
}

class Session {
  doc = new Y.Doc()
  awareness = new Awareness(this.doc)
  sub = ""
  role = ""
  me = { code: "", name: "" }
  synced = false
  presenceNames: string[] = []
  commentsPings = 0
  private ids: (() => string) | null = null
  private abort = new AbortController()
  constructor(readonly label: string, readonly cookie: string, readonly scriptId: string) {}

  async connect() {
    const res = await fetch(`${base}/api/scripts/${this.scriptId}/events`, { headers: { cookie: this.cookie }, signal: this.abort.signal })
    if (!res.ok || !res.body) throw new Error(`${this.label}: events ${res.status}`)
    const reader = res.body.getReader()
    const dec = new TextDecoder()
    let buf = ""
    ;(async () => {
      try {
        for (;;) {
          const { value, done } = await reader.read()
          if (done) break
          buf += dec.decode(value, { stream: true })
          let i
          while ((i = buf.indexOf("\n\n")) >= 0) {
            const block = buf.slice(0, i)
            buf = buf.slice(i + 2)
            const event = /^event: (.*)$/m.exec(block)?.[1]
            const data = /^data: (.*)$/m.exec(block)?.[1]
            if (event && data) this.on(event, JSON.parse(data))
          }
        }
      } catch {
        // aborted at the end
      }
    })()
    await until(() => this.synced, 15000)
  }

  private on(event: string, d: any) {
    if (event === "sync") {
      Y.applyUpdate(this.doc, fromB64(d.update), "server")
      this.sub = d.sub
      this.role = d.role
      this.me = d.me
      this.synced = true
    } else if (event === "update") Y.applyUpdate(this.doc, fromB64(d.update), "server")
    else if (event === "awareness") {
      applyAwarenessUpdate(this.awareness, fromB64(d.update), "remote")
      this.awareness.getStates().forEach((s: any, client: number) => {
        if (client !== this.doc.clientID && s?.user?.name) this.presenceNames.push(s.user.name)
      })
    } else if (event === "comments") this.commentsPings++
  }

  pm() {
    return pmFromYDoc(cloneYDoc(this.doc))
  }

  /** Make `edit` (as suggestions when `suggest`), send it, return the HTTP status and body. */
  async change(edit: (tr: Transaction) => void, suggest: boolean, resolve?: { how: "accept" | "reject"; pick: (id: string) => boolean }) {
    const schema = scriptSchema()
    const state = EditorState.create({ doc: this.pm(), schema })
    let next
    if (resolve) {
      const tr = state.tr
      resolveSuggestions(tr, resolve.how, resolve.pick)
      next = tr.doc
    } else {
      const tr = state.tr
      edit(tr)
      if (suggest) {
        this.ids ??= idGenerator({ code: this.me.code, clientId: this.doc.clientID })
        const res = suggestEdit(state, tr, { code: this.me.code, clientId: this.doc.clientID }, this.ids)
        if (!res.ok) throw new Error(`${this.label}: the editor would refuse this: ${res.why}`)
        next = res.tr.doc
      } else next = tr.doc
    }
    const sv = Y.encodeStateVector(this.doc)
    this.doc.transact(() => updateYFragment(this.doc, this.doc.getXmlFragment(YFRAGMENT), mirrorNodeMarks(next), { mapping: new Map(), isOMark: new Map() }), "local")
    const update = Y.encodeStateAsUpdate(this.doc, sv)
    const res = await fetch(`${base}/api/scripts/${this.scriptId}/updates`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie: this.cookie, origin: base },
      body: JSON.stringify({ client_id: this.doc.clientID, update: b64(update), sub: this.sub }),
    })
    return { status: res.status, body: (await res.json().catch(() => ({}))) as Record<string, any> }
  }

  async api(path: string, init: RequestInit = {}) {
    const res = await fetch(`${base}${path}`, {
      ...init,
      headers: { ...(init.headers as Record<string, string>), cookie: this.cookie, origin: base, "content-type": "application/json" },
    })
    const text = await res.text()
    let body: any = text
    try {
      body = JSON.parse(text)
    } catch {
      // not JSON (an export)
    }
    return { status: res.status, body }
  }

  async presence(state: Record<string, unknown>) {
    this.awareness.setLocalState(state)
    return this.api(`/api/scripts/${this.scriptId}/awareness`, {
      method: "POST",
      body: JSON.stringify({ update: b64(encodeAwarenessUpdate(this.awareness, [this.doc.clientID])), sub: this.sub }),
    })
  }

  close() {
    this.abort.abort()
  }
}

/** Find a text's position in a document. */
function at(doc: ReturnType<Session["pm"]>, s: string) {
  let found = -1
  doc.descendants((node, pos) => {
    if (found >= 0) return false
    if (node.isText && node.text!.includes(s)) found = pos + node.text!.indexOf(s)
    return true
  })
  if (found < 0) throw new Error(`no "${s}" in the script`)
  return found
}
const baseText = (s: Session) => prompterText(rowsOf(viewOf(s.pm(), "base")))

async function main() {
  const suggesterCookie = await signIn(suggesterToken)
  const editorCookie = await signIn(editorToken)
  step(true, "signed in: a client suggester and a client editor (real sign-in links, staging)")

  // the Harmon script's id, from the editor's scripts list
  const list = await fetch(`${base}/client/scripts`, { headers: { cookie: editorCookie } }).then((r) => r.text())
  const id = /href="\/client\/scripts\/([0-9a-f-]{36})"[^>]*>(?:(?!<\/a>)[\s\S])*Harmon SoS/.exec(list)?.[1]
  step(!!id, "the Harmon script is in the editor's Scripts list", id ?? "not found")
  if (!id) return

  let phone1 = new Session("phone 1 (suggester)", suggesterCookie, id)
  const phone2 = new Session("phone 2 (suggester, second device)", suggesterCookie, id)
  const desk = new Session("desktop (editor)", editorCookie, id)
  await Promise.all([phone1.connect(), phone2.connect(), desk.connect()])
  step(phone1.role === "suggester" && phone2.role === "suggester" && desk.role === "editor", "three live connections, roles from the server", `${phone1.role}/${phone2.role}/${desk.role}`)
  const imported = baseText(desk)
  step(imported.startsWith("Hi. Im Mike Harmon"), "everyone opens Mike's own words (the import)", JSON.stringify(imported.slice(0, 40)))

  // presence, names stamped by the server
  await phone1.presence({ user: { name: "Not my real name" }, cursor: null })
  await until(() => desk.presenceNames.length > 0)
  step(desk.presenceNames.includes(phone1.me.name.split(/\s+/)[0]) && !desk.presenceNames.includes("Not my real name"), "the desktop sees who's here, with the name the server stamped", desk.presenceNames.join(", "))

  // a suggestion from phone 1 arrives on phone 2 and the desktop
  const sug = await phone1.change((tr) => tr.insertText("really ", at(tr.doc, "running")), true)
  step(sug.status === 200 && !!sug.body.seq, "phone 1's suggestion is saved (the server's guard passes it)", `HTTP ${sug.status} seq ${sug.body.seq}`)
  const seen = (s: Session) => listSuggestions(s.pm()).some((x) => x.owner === phone1.me.code && x.inserted.includes("really"))
  await until(() => seen(phone2) && seen(desk))
  step(seen(phone2) && seen(desk), "it shows on phone 2 and on the desktop, with phone 1's name on it")
  step(baseText(desk) === imported, "the render and prompter don't include it until it's accepted (v4 #7)")

  // a tampered direct edit from the suggester is refused
  const before = baseText(desk)
  const tamper = await phone1.change((tr) => tr.insertText("Senator ", at(tr.doc, "Mike Harmon and")), false)
  step(tamper.status === 409 && tamper.body.refused === true, "a direct (tampered) edit from the suggester is refused", `HTTP ${tamper.status}: ${tamper.body.why ?? ""}`)
  await sleep(1500)
  step(baseText(desk) === before, "and nobody else ever sees it")
  // what the editor does on a refusal (sync.ts): drop the local copy and start again from the server's
  phone1.close()
  phone1 = new Session("phone 1 (suggester, after the refusal)", suggesterCookie, id)
  await phone1.connect()
  step(baseText(phone1) === before, "the refused phone starts again from the server's copy (its tampered words gone)")

  // the editor accepts the suggestion
  const sugId = listSuggestions(desk.pm()).find((x) => x.owner === phone1.me.code)?.id
  const acc = await desk.change(() => undefined, false, { how: "accept", pick: (x) => x === sugId })
  step(acc.status === 200, "the editor accepts it", `HTTP ${acc.status}`)
  const accepted = (s: Session) => baseText(s).includes("really running") && !listSuggestions(s.pm()).some((x) => x.id === sugId)
  await until(() => accepted(phone1) && accepted(phone2))
  step(accepted(phone1) && accepted(phone2), "both phones now read the accepted words")

  // a comment from the client reaches the desktop live
  const pingsBefore = desk.commentsPings
  const c = await phone1.api(`/api/scripts/${id}/comments`, { method: "POST", body: JSON.stringify({ body: "Rehearsal: can we say 'proud' here?" }) })
  await until(() => desk.commentsPings > pingsBefore)
  const comments = await desk.api(`/api/scripts/${id}/comments`)
  const mine = (comments.body.comments ?? []).find((x: any) => x.id === c.body.id)
  step(c.status === 200 && !!mine && desk.commentsPings > pingsBefore, "a client comment reaches the editor live", `HTTP ${c.status}`)
  if (mine) await desk.api(`/api/scripts/${id}/comments/${mine.id}`, { method: "PATCH", body: JSON.stringify({ resolved: true }) })

  // history: a named version, then restore the import; everyone gets it at once, nothing out of reach
  const named = await desk.api(`/api/scripts/${id}/versions`, { method: "POST", body: JSON.stringify({ name: "Rehearsal checkpoint" }) })
  step(named.status === 200, "the editor names a version", `v${named.body.n}`)
  const r = await desk.api(`/api/scripts/${id}/versions/1/restore`, { method: "POST" })
  step(r.status === 200, "the editor restores version 1 (the import)", `HTTP ${r.status} → v${r.body.n}`)
  await until(() => baseText(phone1) === imported && baseText(phone2) === imported && baseText(desk) === imported)
  const off = [phone1, phone2, desk].filter((s) => baseText(s) !== imported).map((s) => `${s.label}: ${JSON.stringify(baseText(s).slice(0, 60))}`)
  step(!off.length, "both phones and the desktop get the restored words at once", off.join(" | "))
  const versions = await desk.api(`/api/scripts/${id}/versions`)
  const names = (versions.body.versions ?? []).map((v: any) => v.name ?? v.kind)
  step(names.includes("Rehearsal checkpoint") && names.some((n: string) => /^Restored version 1$/.test(n)), "history keeps every step (nothing lost)", names.slice(0, 5).join(" · "))

  // the prompter export is the base text
  const txt = await desk.api(`/api/scripts/${id}/export?format=txt`)
  step(txt.status === 200 && txt.body === imported, "the Prompter .txt export is exactly the script's text")

  for (const s of [phone1, phone2, desk]) s.close()
}

main()
  .catch((e) => step(false, "the rehearsal stopped", String(e?.message ?? e)))
  .finally(() => {
    const out = [`# Scripts proof rehearsal (staging, protocol level) 🤖`, ``, `Run ${new Date().toISOString()} against ${base}.`, ``, ...log.map((l) => `- ${l}`), ``, failures ? `**${failures} FAILED**` : `**All passed.**`].join("\n")
    if (reportPath) writeFileSync(reportPath, out + "\n")
    process.exit(failures ? 1 : 0)
  })
