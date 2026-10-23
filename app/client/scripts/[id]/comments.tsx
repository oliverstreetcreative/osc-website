"use client"
// Comments in the editor (SPEC §14 v1: comment on a selection, reply, resolve; commenting never edits). A comment's
// anchor is a pair of Yjs RELATIVE positions, so it follows the words through everyone's edits; anchored words are
// highlighted. Internal (staff-only) or client-visible is chosen by staff; replies inherit (v4 #11).
import { useCallback, useEffect, useState } from "react"
import type { Editor } from "@tiptap/react"
import { Extension } from "@tiptap/core"
import { Plugin, PluginKey } from "@tiptap/pm/state"
import { Decoration, DecorationSet } from "@tiptap/pm/view"
import * as Y from "yjs"
import { absolutePositionToRelativePosition, relativePositionToAbsolutePosition, ySyncPluginKey } from "@tiptap/y-tiptap"
import { Panel } from "./panels"

type Anchor = { from: string; to: string }
type Comment = {
  id: string
  thread_id: string
  parent_id: string | null
  author: string
  mine: boolean
  body: string
  anchor: Anchor | null
  quote: string | null
  audience: string
  resolved: boolean
  resolved_by: string | null
  at: string
}

const b64 = (u: Uint8Array) => btoa(String.fromCharCode(...u))
const fromB64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0))

type YState = { type: Y.XmlFragment; doc: Y.Doc; binding: { mapping: Map<unknown, unknown> } | null }
const yState = (editor: Editor) => ySyncPluginKey.getState(editor.state) as YState | undefined

/** The current selection as a comment anchor, or null when nothing is selected. */
export function selectionAnchor(editor: Editor): (Anchor & { quote: string }) | null {
  const { from, to } = editor.state.selection
  const ys = yState(editor)
  if (from === to || !ys?.binding) return null
  const f = absolutePositionToRelativePosition(from, ys.type, ys.binding.mapping as never)
  const t = absolutePositionToRelativePosition(to, ys.type, ys.binding.mapping as never)
  return { from: b64(Y.encodeRelativePosition(f)), to: b64(Y.encodeRelativePosition(t)), quote: editor.state.doc.textBetween(from, to, " ").slice(0, 500) }
}

function rangeOf(state: import("@tiptap/pm/state").EditorState, a: Anchor): { from: number; to: number } | null {
  const ys = ySyncPluginKey.getState(state) as YState | undefined
  if (!ys?.binding) return null
  try {
    const f = relativePositionToAbsolutePosition(ys.doc, ys.type, Y.decodeRelativePosition(fromB64(a.from)), ys.binding.mapping as never)
    const t = relativePositionToAbsolutePosition(ys.doc, ys.type, Y.decodeRelativePosition(fromB64(a.to)), ys.binding.mapping as never)
    if (f === null || t === null || t <= f || t > state.doc.content.size) return null
    return { from: f, to: t }
  } catch {
    return null
  }
}

const commentKey = new PluginKey<{ anchors: Anchor[] }>("oscComments")

/** Highlights the words open comments are on. Set the anchors with setCommentAnchors(). */
export const CommentHighlights = Extension.create({
  name: "oscCommentHighlights",
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: commentKey,
        state: {
          init: () => ({ anchors: [] as Anchor[] }),
          apply: (tr, value) => tr.getMeta(commentKey) ?? value,
        },
        props: {
          decorations(state) {
            const { anchors } = commentKey.getState(state) ?? { anchors: [] }
            const decos = anchors.flatMap((a) => {
              const r = rangeOf(state, a)
              return r ? [Decoration.inline(r.from, r.to, { class: "sc-commented" })] : []
            })
            return DecorationSet.create(state.doc, decos)
          },
        },
      }),
    ]
  },
})

export function setCommentAnchors(editor: Editor, anchors: Anchor[]) {
  editor.view.dispatch(editor.state.tr.setMeta(commentKey, { anchors }).setMeta("addToHistory", false))
}

export function CommentsPanel({
  scriptId,
  editor,
  staff,
  canComment,
  bump,
  onClose,
}: {
  scriptId: string
  editor: Editor | null
  staff: boolean
  canComment: boolean
  /** Changes whenever the server says comments changed. */
  bump: number
  onClose: () => void
}) {
  const [comments, setComments] = useState<Comment[] | null>(null)
  const [draft, setDraft] = useState("")
  const [audience, setAudience] = useState(staff ? "office" : "client")
  const [replying, setReplying] = useState<string | null>(null)
  const [reply, setReply] = useState("")
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    const res = await fetch(`/api/scripts/${scriptId}/comments`, { cache: "no-store" }).catch(() => null)
    if (!res?.ok) return setError("Comments need a connection.")
    setError(null)
    setComments((await res.json()).comments)
  }, [scriptId])
  useEffect(() => {
    load()
  }, [load, bump])
  useEffect(() => {
    if (!editor || !comments) return
    setCommentAnchors(editor, comments.filter((c) => !c.parent_id && !c.resolved && c.anchor).map((c) => c.anchor!))
  }, [editor, comments])

  const post = async (data: Record<string, unknown>) => {
    const res = await fetch(`/api/scripts/${scriptId}/comments`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(data),
    }).catch(() => null)
    if (!res?.ok) {
      setError((await res?.json().catch(() => null))?.error ?? "Couldn't post. Try again.")
      return false
    }
    load()
    return true
  }
  const start = async (e: React.FormEvent) => {
    e.preventDefault()
    const anchor = editor ? selectionAnchor(editor) : null
    if (await post({ body: draft, audience, ...(anchor ? { anchor: { from: anchor.from, to: anchor.to }, quote: anchor.quote } : {}) })) setDraft("")
  }
  const answer = async (thread: string) => {
    if (await post({ body: reply, thread_id: thread })) {
      setReply("")
      setReplying(null)
    }
  }
  const resolve = async (c: Comment, resolved: boolean) => {
    await fetch(`/api/scripts/${scriptId}/comments/${c.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ resolved }),
    }).catch(() => null)
    load()
  }
  const jump = (c: Comment) => {
    if (!editor || !c.anchor) return
    const r = rangeOf(editor.state, c.anchor)
    if (r) editor.chain().focus().setTextSelection(r).scrollIntoView().run()
  }

  const threads = (comments ?? []).filter((c) => !c.parent_id)
  const repliesOf = (t: string) => (comments ?? []).filter((c) => c.parent_id && c.thread_id === t)

  return (
    <Panel title="Comments" onClose={onClose}>
      {canComment ? (
        <form className="sc-form col" onSubmit={start}>
          <textarea
            required
            rows={2}
            placeholder="Select words in the script to comment on them, or write a general note"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            aria-label="New comment"
          />
          <div className="sc-form">
            {staff ? (
              <select value={audience} onChange={(e) => setAudience(e.target.value)} aria-label="Who sees it">
                <option value="office">Internal (OSC only)</option>
                <option value="client">The client sees it</option>
              </select>
            ) : null}
            <button className="cs-btn sm">Comment</button>
          </div>
        </form>
      ) : null}
      {error ? <p className="sc-note bad">{error}</p> : null}
      <ul className="sc-sug-list">
        {threads.map((t) => (
          <li key={t.id} className={`sc-thread${t.resolved ? " done" : ""}`}>
            {t.quote ? (
              <button type="button" className="sc-quote" onClick={() => jump(t)}>
                “{t.quote}”
              </button>
            ) : null}
            <p>
              <b>{t.author}</b> {t.audience === "office" ? <span className="cs-pill">Internal</span> : null} {t.body}
            </p>
            {repliesOf(t.thread_id).map((r) => (
              <p key={r.id} className="sc-reply">
                <b>{r.author}</b> {r.body}
              </p>
            ))}
            <div className="sc-sug-acts">
              {canComment && !t.resolved ? (
                replying === t.thread_id ? (
                  <span className="sc-form">
                    <input value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Reply" aria-label="Reply" />
                    <button type="button" className="cs-btn sm" onClick={() => answer(t.thread_id)}>
                      Reply
                    </button>
                  </span>
                ) : (
                  <button type="button" className="cs-btn sm ghost" onClick={() => setReplying(t.thread_id)}>
                    Reply
                  </button>
                )
              ) : null}
              {canComment && (staff || t.mine) ? (
                <button type="button" className="cs-btn sm ghost" onClick={() => resolve(t, !t.resolved)}>
                  {t.resolved ? "Reopen" : "Resolve"}
                </button>
              ) : null}
            </div>
            {t.resolved && t.resolved_by ? <p className="sc-loading">Resolved by {t.resolved_by}</p> : null}
          </li>
        ))}
        {comments && !threads.length ? <li className="sc-loading">No comments yet.</li> : null}
      </ul>
    </Panel>
  )
}
