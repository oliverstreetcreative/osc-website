import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { db } from '@/lib/db'

export async function GET() {
  const hdrs = await headers()
  const userId = hdrs.get('x-user-id')
  const userRole = hdrs.get('x-user-role') ?? 'CLIENT'

  if (!userId) {
    return NextResponse.json({ message: 'Not authenticated' }, { status: 401 })
  }

  // Verify person is portal-allowed
  const person = await db.person.findUnique({
    where: { id: userId },
    select: { id: true, portal_allowed: true },
  })
  if (!person || !person.portal_allowed) {
    return NextResponse.json({ message: 'Not authorized' }, { status: 403 })
  }

  // Determine allowed sources by role
  let allowedSources: string[]
  if (userRole === 'STAFF') {
    allowedSources = ['portal_client', 'portal_crew', 'portal_admin', 'bible']
  } else if (userRole === 'CREW') {
    allowedSources = ['portal_crew', 'bible', 'portal_admin']
  } else {
    // CLIENT (default)
    allowedSources = ['portal_client', 'bible', 'portal_admin']
  }

  // Scope to projects the person belongs to
  let projectIds: string[] | null = null

  if (userRole === 'CLIENT') {
    const contacts = await db.projectContact.findMany({
      where: { person_id: userId },
      select: { project_id: true },
    })
    projectIds = contacts.map((c) => c.project_id)
  } else if (userRole === 'CREW') {
    const participants = await db.projectParticipant.findMany({
      where: { person_id: userId },
      select: { project_id: true },
    })
    projectIds = participants.map((p) => p.project_id)
  }
  // STAFF: no project scoping — sees all

  // Build the where clause
  const whereClause =
    projectIds !== null
      ? {
          source: { in: allowedSources },
          OR: [
            { project_id: { in: projectIds } },
            { person_id: userId },
          ],
        }
      : {
          source: { in: allowedSources },
        }

  const events = await db.portalEvent.findMany({
    where: whereClause,
    orderBy: { occurred_at: 'desc' },
    take: 20,
    select: {
      id: true,
      event_type: true,
      summary: true,
      occurred_at: true,
      source: true,
      project_id: true,
      person_id: true,
    },
  })

  return NextResponse.json({ events })
}
