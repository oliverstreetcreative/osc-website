import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { db } from '@/lib/db'
import { getPortalUser } from '@/lib/portal-auth'

export async function POST(req: NextRequest) {
  const hdrs = await headers()
  const userId = (await getPortalUser())?.id ?? null
  if (!userId) {
    return NextResponse.json({ message: 'Not authenticated' }, { status: 401 })
  }

  // Verify person is portal-allowed
  const person = await db.person.findUnique({
    where: { id: userId },
    select: { portal_allowed: true },
  })
  if (!person?.portal_allowed) {
    return NextResponse.json({ message: 'Not authorized' }, { status: 403 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ message: 'Invalid JSON' }, { status: 400 })
  }

  const { projectId, quoteText, context, permissionStatus } = body as Record<string, unknown>

  if (!projectId || typeof projectId !== 'string') {
    return NextResponse.json({ message: 'Valid projectId is required' }, { status: 400 })
  }
  if (!quoteText || typeof quoteText !== 'string' || !quoteText.trim()) {
    return NextResponse.json({ message: 'quoteText is required' }, { status: 400 })
  }

  // Verify this person is a participant on the project
  const participant = await db.projectParticipant.findFirst({
    where: {
      person_id: userId,
      project_id: projectId,
      project: { client_portal_enabled: true },
    },
  })
  if (!participant) {
    return NextResponse.json({ message: 'Project not found or access denied' }, { status: 403 })
  }

  // Prevent duplicate submission
  const existing = await db.testimonial.findFirst({
    where: { project_id: projectId, person_id: userId },
  })
  if (existing) {
    return NextResponse.json(
      { message: 'You have already submitted a testimonial for this project' },
      { status: 409 }
    )
  }

  // The old create wrote quote_text/context/permission_status, none of which exist on `testimonials` (it has body,
  // rating, approved and required Bible-era columns), so every call failed; and clients can't reach /api/portal (the
  // middleware answers 404 for them). Testimonials get designed into the new client site properly (consent is a
  // fact of its own there); until then this says so instead of throwing. Unused: context, permissionStatus.
  void context
  void permissionStatus
  return NextResponse.json(
    { message: 'Testimonials are moving to the new client site and are not available here yet.' },
    { status: 410 },
  )
}
