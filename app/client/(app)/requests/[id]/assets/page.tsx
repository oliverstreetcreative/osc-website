import Link from "next/link"
import { notFound } from "next/navigation"
import { Check, Paperclip } from "lucide-react"
import { requireClientContext } from "@/lib/client/context"
import { db } from "@/lib/db"
import { canRequest } from "@/lib/client/requests"
import { filesOf, liveFiles } from "@/lib/client/request-drafts"
import { requestName } from "@/app/client/start-cards"

export const metadata = { title: "Your brand assets" }
export const dynamic = "force-dynamic"

const WORDS: Record<string, string> = {
  ok: "Uploaded. Thanks: Sam has it.",
  type: "That kind of file isn't one we can take. PDF, images, design files, fonts and documents are fine.",
  size: "That file is over 25 MB. Send it to Sam instead, or a smaller version.",
  count: "That's the most files one request can hold. Send the rest to Sam.",
  state: "This request can't take files right now.",
  store: "That didn't upload. Try again in a minute.",
  none: "Pick a file first.",
}

// "I'll send these later" (SPEC §31 v2, E): the Needs-you card's page. One file at a time; the first one closes the card.
export default async function LaterAssets({ params, searchParams }: { params: { id: string }; searchParams: { up?: string } }) {
  const ctx = await requireClientContext()
  if (!/^[0-9a-f-]{36}$/i.test(params.id)) notFound()
  const r = await db.projectRequest.findFirst({
    where: { id: params.id, organization_id: ctx.org.id, status: { in: ["pending", "sent", "in_review"] } },
  })
  if (!r || !r.assets_later) notFound()
  const files = liveFiles(filesOf(r.assets))
  const may = !ctx.viewing && (r.person_id === ctx.user.id || canRequest(ctx))
  const up = searchParams.up ?? null
  return (
    <main className="cs-main">
      <Link href={`/client/requests/${r.id}`} className="cs-link">{requestName(r)}</Link>
      <h1 className="cs-title" style={{ marginTop: 10 }}>Your brand assets</h1>
      <p className="cs-lede">Logo (vector if you have it), style guide, fonts, colors: anything with your look.</p>
      {files.length ? (
        <div className="cs-card cs-calm" style={{ marginTop: 18 }}>
          <span className="cs-calm-dot"><Check size={22} /></span>
          <div>
            <h3>Thanks.</h3>
            <p>Sam has {files.length === 1 ? "it" : "them"}. Add more any time.</p>
          </div>
        </div>
      ) : null}
      {files.length ? (
        <ul className="cs-q-files" style={{ marginTop: 14 }}>
          {files.map((f) => (
            <li key={f.n}>
              <Paperclip size={16} aria-hidden />
              <span>{f.name}</span>
            </li>
          ))}
        </ul>
      ) : null}
      {up ? <p className={up === "ok" ? "cs-q-ok" : "cs-q-err"} role="status" style={{ marginTop: 12 }}>{WORDS[up] ?? WORDS.store}</p> : null}
      {may ? (
        <form action="/client/start/upload" method="post" encType="multipart/form-data" className="cs-q-upload" style={{ marginTop: 18 }}>
          <input type="hidden" name="id" value={r.id} />
          <input type="hidden" name="back" value="request" />
          <label className="cs-field">
            <span>Upload a file</span>
            <input type="file" name="file" accept=".pdf,.png,.jpg,.jpeg,.svg,.ai,.eps,.psd,.zip,.otf,.ttf,.woff,.woff2,.txt,.doc,.docx,.key,.pptx" />
          </label>
          <button className="cs-btn">Upload</button>
          <small className="cs-q-help">One file at a time, up to 25 MB each.</small>
        </form>
      ) : (
        <p className="cs-status" style={{ marginTop: 18 }}>{ctx.viewing ? "Uploads are off while viewing." : "Only the person who sent this, or the account's owners, can add files."}</p>
      )}
      <p style={{ marginTop: 22 }}><Link className="cs-link" href="/client">Back to your home</Link></p>
    </main>
  )
}
