import { notFound, redirect } from "next/navigation"
import { requireClientContext } from "@/lib/client/context"
import { answersOf, draftFor, filesOf, liveFiles } from "@/lib/client/request-drafts"
import { isStep, screenProblems } from "@/lib/client/request-form"
import { RequestScreen } from "@/app/client/request-screen"

export const metadata = { title: "Start a project" }
export const dynamic = "force-dynamic"

// One screen of her draft, drawn from what's saved. `check=1` (after a refused save) shows each problem by its field.
export default async function DraftScreen({ params, searchParams }: { params: { id: string; step: string }; searchParams: { check?: string; up?: string; from?: string } }) {
  const ctx = await requireClientContext()
  if (ctx.viewing) redirect("/client/start/look/about")
  if (!isStep(params.step)) notFound()
  const draft = await draftFor(ctx, params.id)
  if (!draft) redirect("/client/start")
  const values = answersOf(draft.answers)[params.step] ?? {}
  const files = filesOf(draft.assets)
  const problems = searchParams.check ? screenProblems(params.step, values, { files: liveFiles(files).length }) : {}
  return (
    <RequestScreen
      step={params.step}
      values={values}
      problems={problems}
      mode="edit"
      id={draft.id}
      who={{ name: ctx.user.name, email: ctx.user.email, company: ctx.org.name }}
      files={files}
      upload={searchParams.up ?? null}
      fromReview={searchParams.from === "review"}
    />
  )
}
