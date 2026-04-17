import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { db } from '@/lib/db'

export async function GET() {
  const hdrs = await headers()
  const userId = hdrs.get('x-user-id')
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

  // Fetch project assignments for this crew member
  const participants = await db.projectParticipant.findMany({
    where: {
      person_id: userId,
      project: { crew_visible: true },
    },
    include: {
      project: { select: { id: true, name: true } },
    },
    orderBy: { project: { name: 'asc' } },
  })

  const result = participants.map((p) => ({
    participantId: p.id,
    role: p.role,
    rateAmount: null,
    rateType: null,
    project: {
      id: p.project.id,
      name: p.project.name,
    },
  }))

  return NextResponse.json(result)
}
