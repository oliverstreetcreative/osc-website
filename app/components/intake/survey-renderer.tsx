"use client"

import { useEffect, useMemo, useState } from "react"
import { Model, type CompleteEvent } from "survey-core"
import { Survey } from "survey-react-ui"
import type { SurveyJsSchema } from "@/lib/form-definitions"
import "survey-core/survey-core.css"

interface SurveyRendererProps {
  slug: string
  surveyJson: SurveyJsSchema
  /** Pre-fill the form with existing answers (used on continuation). */
  initialData?: Record<string, unknown>
  /** When continuing a previously-submitted form, the note Sam wrote asking for more info. */
  samNote?: string
  /** Which fields Sam is specifically asking for this round. Rendered as a hint. */
  requestedFields?: string[]
  /** Identifies the existing Bible row this submission should update instead of create. */
  continuationToken?: string
}

export default function SurveyRenderer({
  slug,
  surveyJson,
  initialData,
  samNote,
  requestedFields,
  continuationToken,
}: SurveyRendererProps) {
  const [submissionState, setSubmissionState] = useState<
    "idle" | "submitting" | "success" | "error"
  >("idle")
  const [errorMessage, setErrorMessage] = useState<string>("")
  const [honeypot, setHoneypot] = useState<string>("")

  const model = useMemo(() => {
    const m = new Model(surveyJson)
    if (initialData) {
      m.data = initialData
    }
    return m
  }, [surveyJson, initialData])

  useEffect(() => {
    const handleComplete = async (sender: Model, options: CompleteEvent) => {
      setSubmissionState("submitting")
      setErrorMessage("")
      options.showSaveInProgress()
      try {
        const res = await fetch(`/api/intake/${slug}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            data: sender.data,
            _hp: honeypot,
            continuation_token: continuationToken,
          }),
        })
        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          throw new Error(body.error || "Submission failed")
        }
        const successMsg = continuationToken
          ? "Sent back to OSC — thanks for the extra details."
          : "Sent to OSC — we'll be in touch."
        options.showSaveSuccess(successMsg)
        setSubmissionState("success")
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Something went wrong"
        options.showSaveError(msg)
        setErrorMessage(msg)
        setSubmissionState("error")
      }
    }
    model.onComplete.add(handleComplete)
    return () => {
      model.onComplete.remove(handleComplete)
    }
  }, [model, slug, honeypot, continuationToken])

  return (
    <div className="survey-wrapper">
      {/* Continuation banner — rendered when Sam has asked for more info. */}
      {samNote && (
        <div className="continuation-banner" role="note">
          <div className="continuation-banner-label">
            A few more things from OSC
          </div>
          <p className="continuation-banner-note">{samNote}</p>
          {requestedFields && requestedFields.length > 0 && (
            <p className="continuation-banner-fields">
              Specifically: {requestedFields.join(", ")}
            </p>
          )}
        </div>
      )}

      {/* Honeypot — hidden from humans, catches bots */}
      <div
        style={{ position: "absolute", left: "-9999px" }}
        aria-hidden="true"
      >
        <input
          type="text"
          name="website"
          tabIndex={-1}
          autoComplete="off"
          value={honeypot}
          onChange={(e) => setHoneypot(e.target.value)}
        />
      </div>

      <Survey model={model} />

      {submissionState === "error" && errorMessage && (
        <div className="intake-server-error" role="alert">
          {errorMessage}
        </div>
      )}
    </div>
  )
}
