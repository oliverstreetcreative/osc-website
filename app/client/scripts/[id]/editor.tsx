"use client"
// The script editor (SPEC §14): live co-editing over lib/scripts/client/sync.ts, suggest mode (normalize.ts), our own
// accept/reject (resolve.ts), the clock from the shared timing module, who's here, and a plain save state.
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react"
import { EditorContent, useEditor, type Editor } from "@tiptap/react"
import Collaboration from "@tiptap/extension-collaboration"
import CollaborationCaret from "@tiptap/extension-collaboration-caret"
import { scriptExtensions } from "@/lib/scripts/schema"
import { YFRAGMENT, renderScript } from "@/lib/scripts/doc"
import { resolveSuggestions } from "@/lib/scripts/resolve"
import { idGenerator } from "@/lib/scripts/normalize"
import { describe, listSuggestions, type SuggestionSummary } from "@/lib/scripts/suggestions"
import { AvKeys, NodeMarkSync, RESOLVE_META, SuggestMode, emptyRow } from "@/lib/scripts/client/extensions"
import { ScriptSync } from "@/lib/scripts/client/sync"
import { History } from "./history"
import { ApprovePanel, FilesPanel, SettingsPanel, SharePanel } from "./panels"
import { CommentHighlights, CommentsPanel } from "./comments"

export type EditorProps = {
  scriptId: string
  /** person code → first name, for "Sam suggested…" */
  people: Record<string, string>
  targetS: number | null
  paceWpm: number
  /** A client's script: Sam suggests by default too (v4 #12). */
  clientsWords: boolean
  /** OSC staff (not viewing as a client). */
  staff: boolean
  settings: { status: string; target_seconds: number | null; approvers: string[]; approval: string }
}

type PanelName = "history" | "comments" | "share" | "settings" | "approve" | "files"

export function ScriptEditor(props: EditorProps) {
  const [generation, setGeneration] = useState(0)
  const [refused, setRefused] = useState<{ why: string; words: string } | null>(null)
  const onRefused = useCallback((why: string, words: string) => {
    setRefused({ why, words })
    setGeneration((g) => g + 1) // start again from the server's copy
  }, [])
  return (
    <>
      {refused ? (
        <div className="sc-note bad" role="alert">
          <p>
            <b>We couldn’t save that as a suggestion</b> ({refused.why}).{" "}
            {refused.words ? "Your words are below: copy them and try again." : "Nothing of yours was lost."}
          </p>
          {refused.words ? <textarea readOnly className="sc-words" value={refused.words} rows={4} /> : null}
          <button type="button" className="cs-btn sm ghost" onClick={() => setRefused(null)}>
            OK
          </button>
        </div>
      ) : null}
      <Session key={generation} {...props} onRefused={onRefused} />
    </>
  )
}

function Session(props: EditorProps & { onRefused: (why: string, words: string) => void }) {
  const [sync, setSync] = useState<ScriptSync | null>(null)
  const editorRef = useRef<Editor | null>(null)
  const refusedRef = useRef(props.onRefused)
  refusedRef.current = props.onRefused
  useEffect(() => {
    const s = new ScriptSync(props.scriptId, {
      onRefused: (why) => {
        const me = s.info?.me.code
        const doc = editorRef.current?.state.doc
        const words = doc && me ? listSuggestions(doc).filter((x) => x.owner === me).map((x) => x.inserted.trim()).filter(Boolean).join("\n") : ""
        refusedRef.current(why, words)
      },
    })
    setSync(s)
    return () => s.destroy()
  }, [props.scriptId])
  if (!sync) return <p className="sc-loading">Opening the script…</p>
  return <Live sync={sync} editorRef={editorRef} {...props} />
}

const STATUS: Record<string, string> = {
  connecting: "Connecting…",
  saved: "Saved",
  saving: "Saving…",
  offline: "Offline, saved on this device",
  "read-only": "Read only",
}

function Live({
  sync,
  editorRef,
  people,
  targetS,
  paceWpm,
  clientsWords,
  staff,
  settings,
}: EditorProps & { sync: ScriptSync; editorRef: React.MutableRefObject<Editor | null> }) {
  const snap = useSyncExternalStore(
    useCallback((fn: () => void) => sync.subscribe(fn), [sync]),
    () => `${sync.state}|${sync.info?.role ?? ""}|${sync.info?.readOnly ?? ""}|${sync.ended ?? ""}|${sync.commentsVersion}`,
    () => "connecting||||0",
  )
  const [state, role, readOnly, ended, commentsVersion] = snap.split("|")
  const canWrite = !ended && !readOnly && (role === "editor" || role === "suggester")
  const isEditor = role === "editor" && !readOnly && !ended
  const [mode, setMode] = useState<"editing" | "suggesting">(clientsWords ? "suggesting" : "editing")
  const suggesting = role !== "editor" || mode === "suggesting"
  const suggestingRef = useRef(suggesting)
  suggestingRef.current = suggesting
  const genRef = useRef<(() => string) | null>(null)
  const [hint, setHint] = useState<string | null>(null)
  const [panel, setPanel] = useState<PanelName | null>(null)
  const toggle = (p: PanelName) => setPanel((cur) => (cur === p ? null : p))
  const canComment = !ended && !readOnly && role !== "viewer" && role !== ""

  const editor = useEditor(
    {
      immediatelyRender: false,
      editable: false,
      extensions: [
        ...scriptExtensions(),
        Collaboration.configure({ document: sync.doc, field: YFRAGMENT }),
        CollaborationCaret.configure({ provider: { awareness: sync.awareness }, user: { name: "", color: "#8a8780" } }),
        NodeMarkSync,
        AvKeys,
        CommentHighlights,
        SuggestMode.configure({
          active: () => suggestingRef.current,
          author: () => (sync.info ? { code: sync.info.me.code, clientId: sync.doc.clientID } : null),
          nextId: () => (genRef.current ??= idGenerator({ code: sync.info!.me.code, clientId: sync.doc.clientID }))(),
          onRefuse: (why) => setHint(why),
        }),
      ],
      editorProps: { attributes: { class: "sc-doc", "aria-label": "Script", spellcheck: "true" } },
    },
    [sync],
  )
  editorRef.current = editor

  useEffect(() => {
    editor?.setEditable(canWrite)
  }, [editor, canWrite])

  useEffect(() => {
    if (!hint) return
    const t = setTimeout(() => setHint(null), 6000)
    return () => clearTimeout(t)
  }, [hint])

  // The clock and the suggestion list follow the document (local and remote changes alike), a quarter second behind.
  const [view, setView] = useState<{ label: string; over: boolean; pending: number; list: SuggestionSummary[] } | null>(null)
  useEffect(() => {
    if (!editor) return
    let t: ReturnType<typeof setTimeout> | null = null
    const recompute = () => {
      if (t) return
      t = setTimeout(() => {
        t = null
        const doc = editor.state.doc
        const r = renderScript(doc, { wpm: paceWpm, target_s: targetS })
        setView({ label: r.label, over: targetS !== null && r.total_s > targetS + 0.5, pending: r.pending_suggestions, list: listSuggestions(doc) })
      }, 250)
    }
    recompute()
    editor.on("update", recompute)
    return () => {
      editor.off("update", recompute)
      if (t) clearTimeout(t)
    }
  }, [editor, paceWpm, targetS])

  // Who's here: the server stamps names on awareness states.
  const [others, setOthers] = useState<{ client: number; name: string; color: string }[]>([])
  useEffect(() => {
    const update = () => setOthers(sync.others())
    sync.awareness.on("change", update)
    update()
    return () => sync.awareness.off("change", update)
  }, [sync])

  const resolve = (how: "accept" | "reject", pick?: (id: string) => boolean) => {
    if (!editor) return
    const tr = editor.state.tr
    resolveSuggestions(tr, how, pick)
    if (!tr.docChanged) return
    tr.setMeta(RESOLVE_META, true)
    editor.view.dispatch(tr)
  }

  const addRow = () => {
    if (!editor) return
    const { state } = editor
    const tr = state.tr.insert(state.doc.content.size, emptyRow(state.schema, crypto.randomUUID()))
    editor.view.dispatch(tr.scrollIntoView())
    editor.commands.focus("end")
  }

  const me = sync.info?.me.code
  const names = (code: string | null) => (code ? people[code] ?? "Someone" : "Someone")
  const uniqueOthers = others.filter((o, i) => others.findIndex((x) => x.name === o.name) === i)

  return (
    <div className="sc-editor">
      <div className="sc-bar" role="toolbar" aria-label="Script tools">
        <div className="sc-bar-left">
          {isEditor ? (
            <div className="sc-seg" role="radiogroup" aria-label="Mode">
              <button type="button" role="radio" aria-checked={mode === "editing"} className={mode === "editing" ? "on" : ""} onClick={() => setMode("editing")}>
                Editing
              </button>
              <button type="button" role="radio" aria-checked={mode === "suggesting"} className={mode === "suggesting" ? "on" : ""} onClick={() => setMode("suggesting")}>
                Suggesting
              </button>
            </div>
          ) : canWrite ? (
            <span className="cs-pill now">Suggesting</span>
          ) : (
            <span className="cs-pill">{ended ? "Closed" : role === "commenter" ? "Can comment" : "Read only"}</span>
          )}
          {canWrite ? (
            <button type="button" className="cs-btn sm ghost" onClick={addRow} title="Add a row (⌘/Ctrl + Enter)">
              + Row
            </button>
          ) : null}
        </div>
        <div className={`sc-clock${view?.over ? " over" : ""}`} aria-live="polite">
          {view ? view.label : "…"}
          {view?.pending ? <small> · {view.pending === 1 ? "1 suggestion" : `${view.pending} suggestions`} not included</small> : null}
        </div>
        <div className="sc-bar-right">
          {uniqueOthers.length ? (
            <span className="sc-here">
              {uniqueOthers.map((o) => (
                <span key={o.client} className="sc-dot" style={{ background: o.color }} aria-hidden />
              ))}
              {uniqueOthers.length === 1 ? `${uniqueOthers[0].name} is here` : `${uniqueOthers.map((o) => o.name).join(", ")} are here`}
            </span>
          ) : null}
          <span className={`sc-save ${state}`}>{ended ? ended : STATUS[state] ?? state}</span>
        </div>
      </div>
      <div className="sc-tools" role="toolbar" aria-label="Panels">
        {(
          [
            ["comments", "Comments", true],
            ["history", "History", true],
            ["share", "Share", isEditor],
            ["settings", "Settings", isEditor],
            ["approve", "Approval", true],
            ["files", "Files", true],
          ] as [PanelName, string, boolean][]
        )
          .filter(([, , show]) => show)
          .map(([name, label]) => (
            <button key={name} type="button" className={`cs-btn sm ${panel === name ? "" : "ghost"}`} aria-expanded={panel === name} onClick={() => toggle(name)}>
              {label}
            </button>
          ))}
      </div>
      {panel === "history" ? <History scriptId={sync.scriptId} canManage={isEditor} onClose={() => setPanel(null)} /> : null}
      {panel === "comments" ? (
        <CommentsPanel scriptId={sync.scriptId} editor={editor} staff={staff} canComment={canComment} bump={Number(commentsVersion)} onClose={() => setPanel(null)} />
      ) : null}
      {panel === "share" ? <SharePanel scriptId={sync.scriptId} staff={staff} onClose={() => setPanel(null)} /> : null}
      {panel === "settings" ? <SettingsPanel scriptId={sync.scriptId} staff={staff} initial={settings} onClose={() => setPanel(null)} /> : null}
      {panel === "approve" ? <ApprovePanel scriptId={sync.scriptId} pending={view?.pending ?? 0} onClose={() => setPanel(null)} /> : null}
      {panel === "files" ? <FilesPanel scriptId={sync.scriptId} onClose={() => setPanel(null)} /> : null}
      {hint ? (
        <p className="sc-note" role="status">
          {hint}
        </p>
      ) : null}
      <div className="sc-cols" aria-hidden>
        <span>Video</span>
        <span>Audio</span>
      </div>
      <EditorContent editor={editor} />
      {view?.list.length ? (
        <section className="sc-sugs" aria-label="Suggestions">
          <div className="cs-h2">
            <span>{view.list.length === 1 ? "1 suggestion" : `${view.list.length} suggestions`}</span>
            {isEditor && view.list.length > 1 ? (
              <span className="sc-sugs-all">
                <button type="button" className="cs-btn sm ghost" onClick={() => resolve("reject")}>
                  Reject all
                </button>
                <button type="button" className="cs-btn sm" onClick={() => resolve("accept")}>
                  Accept all
                </button>
              </span>
            ) : null}
          </div>
          <ul className="sc-sug-list">
            {view.list.map((s) => (
              <li key={s.id} className="sc-sug">
                <span className="sc-sug-who">{s.owner === me ? "You" : names(s.owner)}</span>
                <span className="sc-sug-what">{describe(s)}</span>
                <span className="sc-sug-acts">
                  {isEditor ? (
                    <>
                      <button type="button" className="cs-round" aria-label="Reject" title="Reject" onClick={() => resolve("reject", (id) => id === s.id)}>
                        ✕
                      </button>
                      <button type="button" className="cs-round ok" aria-label="Accept" title="Accept" onClick={() => resolve("accept", (id) => id === s.id)}>
                        ✓
                      </button>
                    </>
                  ) : canWrite && s.owner === me ? (
                    <button type="button" className="cs-btn sm ghost" onClick={() => resolve("reject", (id) => id === s.id)}>
                      Take back
                    </button>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  )
}
