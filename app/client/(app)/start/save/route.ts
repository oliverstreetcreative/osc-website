import { NextResponse } from "next/server"
import { canWrite, getClientContext } from "@/lib/client/context"
import { canRequest } from "@/lib/client/requests"
import { draftFor, ensureDraft, filesOf, liveFiles, saveScreen } from "@/lib/client/request-drafts"
import { isStep, nextStep, parseScreen, prevStep, rowOp, screenProblems, type Posted, type Step } from "@/lib/client/request-form"
import { publicOrigin } from "@/lib/client/host"

export const dynamic = "force-dynamic"

// POST from any screen of Start a project v3 (SPEC §31 v2). It ALWAYS saves what she typed (a refused screen keeps
// every word), then goes where her button said: the next screen (or back to this one with its problems), the previous
// one, a row added or removed, or Home ("Finish later"). Middleware already refused cross-origin and viewing writes.
export async function POST(req: Request) {
  const ctx = await getClientContext()
  if (!canWrite(ctx)) return new NextResponse(null, { status: ctx ? 403 : 401 })
  const base = publicOrigin(req)
  if (!canRequest(ctx)) return NextResponse.redirect(`${base}/client/start`, 303)
  const form = await req.formData()
  const posted: Posted = {
    get: (n) => {
      const v = form.get(n)
      return typeof v === "string" ? v : null
    },
    getAll: (n) => form.getAll(n).filter((v): v is string => typeof v === "string"),
  }
  const step = posted.get("step") ?? ""
  if (!isStep(step)) return NextResponse.redirect(`${base}/client/start`, 303)
  const id = posted.get("id")
  const draft = id ? await draftFor(ctx, id) : await ensureDraft(ctx)
  if (!draft) return NextResponse.redirect(`${base}/client/start`, 303)

  const op = posted.get("op") ?? "next"
  const values = parseScreen(step, posted, op)
  const files = liveFiles(filesOf(draft.assets)).length
  let to: Step | "review" | "home"
  let query = ""
  let anchor = ""
  const rop = rowOp(op)
  if (rop) {
    to = step
    anchor = `#${rop.field}`
  } else if (op === "back") {
    to = prevStep(step)
  } else if (op === "later") {
    to = "home"
  } else if (Object.keys(screenProblems(step, values, { files })).length) {
    to = step
    query = "?check=1"
  } else {
    to = nextStep(step)
  }
  await saveScreen(draft.id, step, values, to === "home" ? step : to)
  if (to === "home") return NextResponse.redirect(`${base}/client?saved=1`, 303)
  return NextResponse.redirect(`${base}/client/start/${draft.id}/${to}${query}${anchor}`, 303)
}
