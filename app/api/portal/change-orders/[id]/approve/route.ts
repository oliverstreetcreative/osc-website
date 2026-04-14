import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { db } from '@/lib/db'

interface Params {
  params: Promise<{ id: string }>
}

export async function POST(_req: NextRequest, { params }: Params) {
  const { id: changeOrderId } = await params

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

  // Load change order and verify client_visible
  const changeOrder = await db.changeOrder.findUnique({
    where: { id: changeOrderId },
    select: {
      id: true,
      project_id: true,
      client_visible: true,
      status: true,
    },
  })
  if (!changeOrder || !changeOrder.client_visible) {
    return NextResponse.json({ message: 'Change order not found' }, { status: 404 })
  }

  // Verify user is a participant on the project
  const participant = await db.projectParticipant.findFirst({
    where: {
      person_id: userId,
      project_id: changeOrder.project_id,
      project: { client_portal_enabled: true },
    },
  })
  if (!participant) {
    return NextResponse.json({ message: 'Access denied' }, { status: 403 })
  }

  // Update the change order
  const updated = await db.changeOrder.update({
    where: { id: changeOrderId },
    data: {
      status: 'Approved',
      approved_at: new Date(),
      approved_by: person.name,
    },
  })

  return NextResponse.json(updated)
}
