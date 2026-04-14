import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { db } from '@/lib/db'

export async function POST(req: NextRequest) {
  const hdrs = await headers()
  const userId = hdrs.get('x-user-id')
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

  const testimonial = await db.testimonial.create({
    data: {
      project_id: projectId,
      person_id: userId,
      quote_text: (quoteText as string).trim(),
      context: typeof context === 'string' ? context.trim() : '',
      permission_status: permissionStatus === 'denied' ? 'denied' : 'granted',
    },
  })

  return NextResponse.json(testimonial, { status: 201 })
}
