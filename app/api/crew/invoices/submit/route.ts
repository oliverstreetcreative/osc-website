import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { db } from '@/lib/db'
import { isImpersonating } from '@/lib/auth/impersonation'

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

  // Verify person exists and is portal-allowed
  const person = await db.person.findUnique({
    where: { id: userId },
    select: { id: true, name: true, portal_allowed: true },
  })
  if (!person || !person.portal_allowed) {
    return NextResponse.json({ message: 'Not authorized' }, { status: 403 })
  }

  // Parse body
  let body: {
    projectId?: string
    projectName?: string
    role?: string
    rateAmount?: number
    rateType?: string
    dateStart?: string
    dateEnd?: string
    hoursPerDay?: number
    daysWorked?: number
    kitRental?: number
    mileage?: number
    perDiem?: number
    notes?: string
    total?: number
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ message: 'Invalid JSON body' }, { status: 400 })
  }

  const { projectId, projectName, role, rateAmount, rateType, dateStart, dateEnd, hoursPerDay, daysWorked, kitRental, mileage, perDiem, notes, total } = body

  if (!projectId) {
    return NextResponse.json({ message: 'projectId is required' }, { status: 400 })
  }

  // Verify user is a ProjectParticipant on the project
  const participant = await db.projectParticipant.findFirst({
    where: {
      person_id: userId,
      project_id: projectId,
    },
  })
  if (!participant) {
    return NextResponse.json(
      { message: 'You are not a participant on this project' },
      { status: 403 },
    )
  }

  const firstName = person.name.split(' ')[0]

  // Create the portal event for invoice submission
  const event = await db.portalEvent.create({
    data: {
      person_id: person.id,
      project_id: projectId,
      event_type: 'invoice_submitted',
      summary: `${firstName} submitted an invoice`,
      source: 'portal_crew',
      details: {
        projectId,
        projectName: projectName ?? '',
        role: role ?? '',
        rateAmount: rateAmount ?? 0,
        rateType: rateType ?? 'daily',
        dateStart: dateStart ?? '',
        dateEnd: dateEnd ?? '',
        hoursPerDay: hoursPerDay ?? 0,
        daysWorked: daysWorked ?? 0,
        kitRental: kitRental ?? 0,
        mileage: mileage ?? 0,
        perDiem: perDiem ?? 0,
        notes: notes ?? '',
        total: total ?? 0,
      },
      processed_at: null,
      source_bible_id: null,
      source_bible_table: null,
      published_at: null,
      publication_version: null,
    },
  })

  return NextResponse.json({ success: true, total: total ?? 0, eventId: event.id }, { status: 201 })
}
