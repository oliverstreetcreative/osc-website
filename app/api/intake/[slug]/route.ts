import { NextRequest, NextResponse } from "next/server"
import { getFormDefinition } from "@/lib/form-definitions"
import { enqueueIntakeSubmission, generateDraftToken } from "@/lib/intake-queue"

// Simple in-memory rate limiter: 5 submissions per IP per hour
const rateLimitMap = new Map<string, number[]>()
const RATE_LIMIT = 5
const RATE_WINDOW = 60 * 60 * 1000

function checkRateLimit(ip: string): boolean {
  const now = Date.now()
  const timestamps = rateLimitMap.get(ip) || []
  const recent = timestamps.filter((t) => now - t < RATE_WINDOW)
  if (recent.length >= RATE_LIMIT) return false
  recent.push(now)
  rateLimitMap.set(ip, recent)
  return true
}

/**
 * Minimal server-side validation. SurveyJS enforces required fields client-side,
 * but we don't trust clients. We only re-check that every `isRequired: true`
 * question has a value — anything more precise (regex, ranges) was already
 * validated client-side and we accept the risk of bypass for MVP.
 */
function validateRequiredFields(
  data: Record<string, unknown>,
  definition: Awaited<ReturnType<typeof getFormDefinition>>
): string[] {
  if (!definition) return []
  const missing: string[] = []
  for (const page of definition.surveyJson.pages || []) {
    for (const element of page.elements || []) {
      // Recurse into panels
      const nested = (element as { elements?: unknown[] }).elements
      const elements = Array.isArray(nested) ? nested : [element]
      for (const el of elements) {
        const q = el as { name?: string; isRequired?: boolean }
        if (q.isRequired && q.name) {
          const v = data[q.name]
          if (v === undefined || v === null || v === "") {
            missing.push(q.name)
          }
        }
      }
    }
  }
  return missing
}

interface RouteContext {
  params: Promise<{ slug: string }>
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { slug } = await context.params
    const body = await request.json()
    const {
      data,
      _hp,
      draftToken,
      continuation_token: continuationToken,
    } = body as {
      data: Record<string, unknown>
      _hp?: string
      draftToken?: string
      continuation_token?: string
    }

    // Honeypot: silently succeed so bots don't know they failed
    if (_hp) {
      return NextResponse.json({ success: true })
    }

    // Look up the form definition
    const definition = await getFormDefinition(slug)
    if (!definition) {
      return NextResponse.json(
        { error: "Form not found" },
        { status: 404 }
      )
    }

    // Rate limit
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "unknown"
    if (!checkRateLimit(ip)) {
      return NextResponse.json(
        { error: "Too many submissions. Please try again later." },
        { status: 429 }
      )
    }

    if (!data || typeof data !== "object") {
      return NextResponse.json(
        { error: "Missing submission data" },
        { status: 400 }
      )
    }

    const missing = validateRequiredFields(data, definition)
    if (missing.length > 0) {
      return NextResponse.json(
        {
          error: `Missing required fields: ${missing.join(", ")}`,
          missing,
        },
        { status: 400 }
      )
    }

    const result = await enqueueIntakeSubmission({
      type: slug as never, // slug identifies the form; drain writes it to form_slug
      draft_token: draftToken || generateDraftToken(),
      continuation_token: continuationToken,
      submitted_at: new Date().toISOString(),
      submitted_from_ip: ip,
      user_agent: request.headers.get("user-agent") || undefined,
      form_version: definition.version,
      data,
    })

    if (!result.success) {
      console.error("Intake queue error:", result.error)
      return NextResponse.json(
        { error: "Something went wrong. Please try again." },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("Intake submission error:", err)
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    )
  }
}
