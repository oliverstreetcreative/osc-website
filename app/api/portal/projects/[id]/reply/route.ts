import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { db } from '@/lib/db'

interface Params {
  params: Promise<{ id: string }>
}

export async function POST(req: NextRequest, { params }: Params) {
  const { id: projectId } = await params

  const hdrs = await headers()
  const userId = hdrs.get('x-user-id')
  if (!userId) {
    return NextResponse.json({ message: 'Not authenticated' }, { status: 401 })
  }

  // Verify portal access
  const person = await db.person.findUnique({
    where: { id: userId },
    select: { portal_allowed: true, name: true },
  })
  if (!person?.portal_allowed) {
    return NextResponse.json({ message: 'Not authorized' }, { status: 403 })
  }

  // Verify project access
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

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ message: 'Invalid JSON' }, { status: 400 })
  }

  const { updateId, reply } = body as Record<string, unknown>

  if (!updateId || typeof updateId !== 'string') {
    return NextResponse.json({ message: 'updateId is required' }, { status: 400 })
  }
  if (!reply || typeof reply !== 'string' || !reply.trim()) {
    return NextResponse.json({ message: 'reply text is required' }, { status: 400 })
  }

  // Verify the update belongs to this project
  const update = await db.projectUpdate.findFirst({
    where: { id: updateId, project_id: projectId },
    select: { id: true, client_reply: true },
  })
  if (!update) {
    return NextResponse.json({ message: 'Update not found' }, { status: 404 })
  }
  if (update.client_reply) {
    return NextResponse.json({ message: 'Reply already submitted' }, { status: 409 })
  }

  const updated = await db.projectUpdate.update({
    where: { id: updateId },
    data: {
      client_reply: reply.trim(),
      client_replied_at: new Date(),
    },
    select: { id: true },
  })

  return NextResponse.json({ ok: true, id: updated.id })
}
