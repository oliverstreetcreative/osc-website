"use client"
// The editor's side panels (SPEC §14): Share (phone moment 1), the script's settings (status that puts it in the
// client's Needs you, length, approvers), Approve (v4 #7), and the files (phone moment 7). Each talks to its own route.
import { useCallback, useEffect, useState } from "react"

async function call(url: string, init?: RequestInit) {
  const res = await fetch(url, { cache: "no-store", ...init }).catch(() => null)
  const body = res ? await res.json().catch(() => ({})) : {}
  return { ok: !!res?.ok, body: body as Record<string, any>, offline: !res }
}
const json = (method: string, data: unknown): RequestInit => ({ method, headers: { "content-type": "application/json" }, body: JSON.stringify(data) })

export function Panel({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <section className="sc-history" aria-label={title}>
      <div className="cs-h2">
        <span>{title}</span>
        <button type="button" className="cs-btn sm ghost" onClick={onClose}>
          Close
        </button>
      </div>
      {children}
    </section>
  )
}

// ------------------------------------------------------------------------------------------------- Share

type Access = { id: string; who: string; email: string | null; role: string; accepted: boolean; expires_at: string | null }
const ROLE_WORDS: Record<string, string> = { viewer: "Can read", commenter: "Can comment", suggester: "Can suggest", editor: "Can edit" }

export function SharePanel({ scriptId, staff, onClose }: { scriptId: string; staff: boolean; onClose: () => void }) {
  const [list, setList] = useState<Access[] | null>(null)
  const [email, setEmail] = useState("")
  const [role, setRole] = useState("suggester")
  const [until, setUntil] = useState("")
  const [msg, setMsg] = useState<{ text: string; link?: string; bad?: boolean } | null>(null)
  const [busy, setBusy] = useState(false)
  const load = useCallback(async () => {
    const r = await call(`/api/scripts/${scriptId}/share`)
    if (r.ok) setList(r.body.access)
    else setMsg({ text: r.offline ? "Sharing needs a connection." : r.body.error ?? "Couldn't load who has access.", bad: true })
  }, [scriptId])
  useEffect(() => {
    load()
  }, [load])

  const invite = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    const r = await call(`/api/scripts/${scriptId}/share`, json("POST", { email, role, expires_at: until || undefined }))
    setBusy(false)
    if (!r.ok) return setMsg({ text: r.body.error ?? "Couldn't share. Try again.", bad: true })
    setMsg({ text: r.body.emailed ? `Sent to ${email}.` : `Not emailed (${r.body.why}). Copy the link and send it yourself.`, link: r.body.link })
    setEmail("")
    load()
  }
  const revoke = async (a: Access) => {
    if (!window.confirm(`Stop sharing with ${a.who}?`)) return
    const r = await call(`/api/scripts/${scriptId}/share`, json("DELETE", { access_id: a.id }))
    if (r.ok) load()
  }
  const copy = async (link: string) => {
    try {
      await navigator.clipboard.writeText(link)
      setMsg((m) => (m ? { ...m, text: "Link copied. It works for 14 days and signs them in." } : m))
    } catch {
      window.prompt("Copy this link", link)
    }
  }

  return (
    <Panel title="Share" onClose={onClose}>
      <form className="sc-form" onSubmit={invite}>
        <input type="email" required placeholder="Their email address" value={email} onChange={(e) => setEmail(e.target.value)} aria-label="Email" />
        <select value={role} onChange={(e) => setRole(e.target.value)} aria-label="What they can do">
          <option value="suggester">Can suggest</option>
          <option value="commenter">Can comment</option>
          <option value="viewer">Can read</option>
          {staff ? <option value="editor">Can edit</option> : null}
        </select>
        <label className="sc-until">
          Access ends <input type="date" value={until} onChange={(e) => setUntil(e.target.value)} />
        </label>
        <button className="cs-btn sm" disabled={busy}>
          Send invite
        </button>
      </form>
      {msg ? (
        <p className={`sc-note${msg.bad ? " bad" : ""}`}>
          {msg.text}{" "}
          {msg.link ? (
            <button type="button" className="cs-btn sm ghost" onClick={() => copy(msg.link!)}>
              Copy link
            </button>
          ) : null}
        </p>
      ) : null}
      <ul className="sc-sug-list">
        {(list ?? []).map((a) => (
          <li key={a.id} className="sc-sug">
            <span className="sc-sug-who">{a.who}</span>
            <span className="sc-sug-what">
              {ROLE_WORDS[a.role] ?? a.role}
              {a.accepted ? "" : " · invited"}
              {a.expires_at ? ` · until ${new Date(a.expires_at).toLocaleDateString()}` : ""}
            </span>
            <span className="sc-sug-acts">
              <button type="button" className="cs-btn sm ghost" onClick={() => revoke(a)}>
                Remove
              </button>
            </span>
          </li>
        ))}
        {list && !list.length ? <li className="sc-loading">Only OSC can see this script.</li> : null}
      </ul>
    </Panel>
  )
}

// ------------------------------------------------------------------------------------------------- Settings

export function SettingsPanel({ scriptId, staff, initial, onClose }: {
  scriptId: string
  staff: boolean
  initial: { status: string; target_seconds: number | null; approvers: string[]; approval: string }
  onClose: () => void
}) {
  const [status, setStatus] = useState(initial.status === "approved" ? "draft" : initial.status)
  const [target, setTarget] = useState(initial.target_seconds ? String(initial.target_seconds) : "")
  const [approvers, setApprovers] = useState(initial.approvers.join(", "))
  const [approval, setApproval] = useState(initial.approval)
  const [msg, setMsg] = useState<{ text: string; bad?: boolean } | null>(null)
  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    const data: Record<string, unknown> = { status, target_seconds: target ? Number(target) : null }
    if (staff) {
      data.approvers = approvers.split(/[,\s]+/).map((x) => x.trim()).filter(Boolean)
      data.approval = approval
    }
    const r = await call(`/api/scripts/${scriptId}`, json("PATCH", data))
    setMsg(r.ok ? { text: "Saved." } : { text: r.body.error ?? "Couldn't save. Try again.", bad: true })
  }
  return (
    <Panel title="Settings" onClose={onClose}>
      <form className="sc-form col" onSubmit={save}>
        <label>
          Status
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="draft">Draft</option>
            <option value="ready_for_notes">Ready for the client&rsquo;s notes</option>
            <option value="ready_for_ok">Ready for the client&rsquo;s OK</option>
          </select>
        </label>
        <label>
          Length (seconds)
          <input inputMode="numeric" pattern="[0-9]*" placeholder="30" value={target} onChange={(e) => setTarget(e.target.value.replace(/\D/g, ""))} />
        </label>
        {staff ? (
          <>
            <label>
              Approvers (emails)
              <input value={approvers} onChange={(e) => setApprovers(e.target.value)} placeholder="mike@example.com" />
            </label>
            <label>
              Approval
              <select value={approval} onChange={(e) => setApproval(e.target.value)}>
                <option value="any">Any one approver</option>
                <option value="all">Every approver</option>
              </select>
            </label>
          </>
        ) : null}
        <button className="cs-btn sm">Save</button>
      </form>
      {msg ? <p className={`sc-note${msg.bad ? " bad" : ""}`}>{msg.text}</p> : null}
    </Panel>
  )
}

// ------------------------------------------------------------------------------------------------- Approve

export function ApprovePanel({ scriptId, pending, onClose }: { scriptId: string; pending: number; onClose: () => void }) {
  const [info, setInfo] = useState<{ can_approve: boolean; status: string; approvals: { version_n: number; name: string; at: string; note: string | null }[] } | null>(null)
  const [note, setNote] = useState("")
  const [msg, setMsg] = useState<{ text: string; bad?: boolean } | null>(null)
  const load = useCallback(async () => {
    const r = await call(`/api/scripts/${scriptId}/approve`)
    if (r.ok) setInfo(r.body as any)
  }, [scriptId])
  useEffect(() => {
    load()
  }, [load])
  const approve = async () => {
    if (!window.confirm("Approve the script exactly as it reads now? This makes a dated record.")) return
    const r = await call(`/api/scripts/${scriptId}/approve`, json("POST", { note }))
    setMsg(r.ok ? { text: `Approved as version ${r.body.version_n}.` } : { text: r.body.error ?? "Couldn't approve. Try again.", bad: true })
    load()
  }
  return (
    <Panel title="Approval" onClose={onClose}>
      {info?.can_approve ? (
        pending ? (
          <p className="sc-note">There {pending === 1 ? "is 1 suggestion" : `are ${pending} suggestions`} waiting. Approve once they&rsquo;re accepted or rejected.</p>
        ) : (
          <div className="sc-form col">
            <label>
              Note (optional)
              <input value={note} onChange={(e) => setNote(e.target.value)} />
            </label>
            <button type="button" className="cs-btn sm" onClick={approve}>
              Approve this version
            </button>
          </div>
        )
      ) : (
        <p className="sc-loading">{info ? "Approvals are made by the approvers Sam names." : "Loading…"}</p>
      )}
      {msg ? <p className={`sc-note${msg.bad ? " bad" : ""}`}>{msg.text}</p> : null}
      <ul className="sc-sug-list">
        {(info?.approvals ?? []).map((a, i) => (
          <li key={i} className="sc-sug">
            <span className="sc-sug-who">v{a.version_n}</span>
            <span className="sc-sug-what">
              Approved by {a.name} · {new Date(a.at).toLocaleString()}
              {a.note ? ` · “${a.note}”` : ""}
            </span>
          </li>
        ))}
      </ul>
    </Panel>
  )
}

// ------------------------------------------------------------------------------------------------- Files

export function FilesPanel({ scriptId, onClose }: { scriptId: string; onClose: () => void }) {
  return (
    <Panel title="Files" onClose={onClose}>
      <p className="sc-loading">Always the script without pending suggestions.</p>
      <div className="sc-form">
        <a className="cs-btn sm ghost" href={`/api/scripts/${scriptId}/export?format=txt`}>
          Prompter (.txt)
        </a>
        <a className="cs-btn sm ghost" href={`/client/scripts/${scriptId}/print`}>
          PDF (print view)
        </a>
        <a className="cs-btn sm ghost" href={`/api/scripts/${scriptId}/export?format=docx`}>
          Word (.docx)
        </a>
      </div>
    </Panel>
  )
}
