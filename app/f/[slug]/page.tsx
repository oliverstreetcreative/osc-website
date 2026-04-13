import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { getFormDefinition } from "@/lib/form-definitions"
import { getContinuation } from "@/lib/continuations"
import { IntakeLayout } from "../../components/intake/shared"
import SurveyRenderer from "../../components/intake/survey-renderer"

interface PageProps {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ continuation?: string }>
}

export const dynamic = "force-dynamic"

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params
  const definition = await getFormDefinition(slug)
  if (!definition) {
    return { title: "Form not found — Oliver Street Creative" }
  }
  return {
    title: `${definition.title} | Oliver Street Creative`,
    description: definition.subtitle,
    alternates: {
      canonical: `https://oliverstreetcreative.com/f/${slug}`,
    },
  }
}

export default async function DynamicFormPage({
  params,
  searchParams,
}: PageProps) {
  const { slug } = await params
  const { continuation: continuationToken } = await searchParams

  const definition = await getFormDefinition(slug)
  if (!definition) {
    notFound()
  }

  // If the URL has a ?continuation=token, fetch the continuation file and
  // pass the existing answers + Sam's note + requested fields into the renderer.
  // If the continuation is missing or expired, fall through to a fresh form.
  const continuation = continuationToken
    ? await getContinuation(continuationToken)
    : null

  // Defensive: continuation must match the slug the client is visiting.
  // Prevents a token for form A being used to update form B.
  const activeContinuation =
    continuation && continuation.form_slug === slug ? continuation : null

  return (
    <IntakeLayout
      title={definition.title}
      subtitle={definition.subtitle || ""}
    >
      <SurveyRenderer
        slug={slug}
        surveyJson={definition.surveyJson}
        initialData={activeContinuation?.existing_answers}
        samNote={activeContinuation?.sam_note}
        requestedFields={activeContinuation?.requested_fields}
        continuationToken={activeContinuation?.continuation_token}
      />
    </IntakeLayout>
  )
}
