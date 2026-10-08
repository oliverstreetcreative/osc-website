import { notFound } from "next/navigation"
import { requireClientContext } from "@/lib/client/context"
import { isStep } from "@/lib/client/request-form"
import { RequestScreen } from "@/app/client/request-screen"

export const metadata = { title: "Start a project" }
export const dynamic = "force-dynamic"

// SPEC §31 v2: staff viewing as a client, the demo and preview sign-ins can't POST, so they walk the screens
// read-only: no draft, nothing saved, Send off. The screenshot frames use this too.
export default async function LookScreen({ params }: { params: { step: string } }) {
  const ctx = await requireClientContext()
  if (!isStep(params.step)) notFound()
  return (
    <RequestScreen
      step={params.step}
      values={{}}
      problems={{}}
      mode="look"
      who={{ name: ctx.user.name, email: ctx.user.email, company: ctx.org.name }}
    />
  )
}
