import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { db } from '@/lib/db'
import { isImpersonating } from '@/lib/auth/impersonation'

const VALID_EVENT_TYPES = [
  'deliverable_approved',
  'change_order_approved',
  'message_posted',
  'upload_completed',
  'task_checked',
  'task_unchecked',
  'visibility_flip',
] as const

type EventType = (typeof VALID_EVENT_TYPES)[number]

function sourceFromRole(role: string): string {
  switch (role) {
    case 'STAFF':
      return 'portal_admin'
    case 'CLIENT':
      return 'portal_client'
    case 'CREW':
      return 'portal_crew'
    default:
      return 'portal_client'
  }
}

function buildSummary(eventType: EventType, personName: string): string {
  const first = personName.split(' ')[0]
  switch (eventType) {
    case 'deliverable_approved':
      return `${first} approved a deliverable`
    case 'change_order_approved':
      return `${first} approved a change order`
    case 'message_posted':
      return `${first} posted a message`
    case 'upload_completed':
      return `${first} completed an upload`
    case 'task_checked':
      return `${first} checked off a task`
    case 'task_unchecked':
      return `${first} unchecked a task`
    case 'visibility_flip':
      return `${first} toggled visibility on an item`
    default:
      return `${first} triggered ${eventType}`
  }
}

export async function POST(req: NextRequest) {
  // Impersonation check — read-only mode
  if (await isImpersonating()) {
    return NextResponse.json(
      { error: 'Impersonation mode is read-only. Stop impersonating to take actions.' },
      { status: 403 },
    )
  }

  const hdrs = await headers()
  const userId = hdrs.get('x-user-id')
  if (!userId) {
    return NextResponse.json({ message: 'Not authenticated' }, { status: 401 })
  }

  // Verify person exists and is portal_allowed
  const person = await db.person.findUnique({
    where: { id: userId },
    select: { id: true, name: true, portal_allowed: true, role: true },
  })
  if (!person || !person.portal_allowed) {
    return NextResponse.json({ message: 'Not authorized' }, { status: 403 })
  }

  // Parse body
  let body: { event_type?: string; project_id?: string; payload?: Record<string, unknown> }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ message: 'Invalid JSON body' }, { status: 400 })
  }

  const { event_type, project_id, payload } = body

  // Validate event_type
  if (!event_type || !VALID_EVENT_TYPES.includes(event_type as EventType)) {
    return NextResponse.json(
      {
        message: `Invalid event_type. Must be one of: ${VALID_EVENT_TYPES.join(', ')}`,
      },
      { status: 400 },
    )
  }

  // If project_id provided, verify user is a ProjectParticipant on the project
  if (project_id) {
    const participant = await db.projectParticipant.findFirst({
      where: {
        person_id: userId,
        project_id,
      },
    })
    if (!participant) {
      return NextResponse.json(
        { message: 'You are not a participant on this project' },
        { status: 403 },
      )
    }
  }

  const source = sourceFromRole(person.role)
  const summary = buildSummary(event_type as EventType, person.name)

  const event = await db.portalEvent.create({
    data: {
      person_id: person.id,
      project_id: project_id ?? null,
      event_type,
      summary,
      details: payload ?? null,
      source,
      processed_at: null,
      // Publication fields intentionally null for portal-originated events
      source_bible_id: null,
      source_bible_table: null,
      published_at: null,
      publication_version: null,
    },
  })

  return NextResponse.json(event, { status: 201 })
}
