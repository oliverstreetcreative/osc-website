import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { db } from '@/lib/db'

interface Params {
  params: Promise<{ id: string }>
}

export async function POST(_req: NextRequest, { params }: Params) {
  const { id: obligationId } = await params

  const hdrs = await headers()
  const userId = hdrs.get('x-user-id')
  if (!userId) {
    return NextResponse.json({ message: 'Not authenticated' }, { status: 401 })
  }

  // Verify person exists and is portal_allowed
  const person = await db.person.findUnique({
    where: { id: userId },
    select: { id: true, name: true, portal_allowed: true },
  })
  if (!person?.portal_allowed) {
    return NextResponse.json({ message: 'Not authorized' }, { status: 403 })
  }

  // Load obligation and verify client_visible
  const obligation = await db.obligation.findUnique({
    where: { id: obligationId },
    select: {
      id: true,
      project_id: true,
      client_visible: true,
    },
  })
  if (!obligation || !obligation.client_visible) {
    return NextResponse.json({ message: 'Invoice not found' }, { status: 404 })
  }

  // Verify user is a participant on the project
  const participant = await db.projectParticipant.findFirst({
    where: {
      person_id: userId,
      project_id: obligation.project_id,
      project: { client_portal_enabled: true },
    },
  })
  if (!participant) {
    return NextResponse.json({ message: 'Access denied' }, { status: 403 })
  }

  // Create a PortalEvent logging the payment link request
  // Schema: event_type (String), summary (String required), details (Json?), occurred_at (DateTime)
  await db.portalEvent.create({
    data: {
      person_id: userId,
      project_id: obligation.project_id,
      event_type: 'payment_link_requested',
      summary: `Payment link requested by ${person.name} for obligation ${obligationId}`,
      details: { obligation_id: obligationId },
      occurred_at: new Date(),
      // Publication metadata (required by schema)
      source_bible_id: 0,
      source_bible_table: 'portal',
      published_at: new Date(),
      publication_version: 1,
    },
  })

  return NextResponse.json({ ok: true, message: 'Payment link request submitted.' })
}
