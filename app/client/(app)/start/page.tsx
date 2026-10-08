import { redirect } from "next/navigation"
import { requireClientContext } from "@/lib/client/context"
import { canRequest } from "@/lib/client/requests"
import { currentDraft } from "@/lib/client/request-drafts"
import { isStep } from "@/lib/client/request-form"
import { isPreviewSession } from "@/lib/auth/require-session"
import { RequestScreen } from "@/app/client/request-screen"
import { OSC_PHONE, OSC_SMS } from "@/app/client/ui"

export const metadata = { title: "Start a project" }
export const dynamic = "force-dynamic"

// SPEC §31 v2: Start a project v3. Her draft, if she has one, picks up where she left it (any device). Otherwise the
// first screen; the draft is made the first time she saves. Staff viewing, the demo and preview sign-ins can't POST,
// so they walk the screens read-only.
export default async function StartProject() {
  const ctx = await requireClientContext()
  if (ctx.viewing || (await isPreviewSession())) redirect("/client/start/look/about")
  if (!canRequest(ctx)) {
    return (
      <main className="cs-main">
        <p className="cs-eyebrow">{ctx.org.name}</p>
        <h1 className="cs-title" style={{ marginTop: 6 }}>Start a project</h1>
        <div className="cs-card cs-pad" style={{ marginTop: 20 }}>
          <p>Want another video?</p>
          <a className="cs-btn" style={{ marginTop: 14 }} href={OSC_SMS}>Text Sam · {OSC_PHONE}</a>
        </div>
      </main>
    )
  }
  const draft = await currentDraft(ctx)
  if (draft) redirect(`/client/start/${draft.id}/${draft.step && (isStep(draft.step) || draft.step === "review") ? draft.step : "about"}`)
  return (
    <RequestScreen
      step="about"
      values={{}}
      problems={{}}
      mode="edit"
      who={{ name: ctx.user.name, email: ctx.user.email, company: ctx.org.name }}
    />
  )
}
