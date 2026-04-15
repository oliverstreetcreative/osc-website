import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { db } from '@/lib/db'
import { isImpersonating } from '@/lib/auth/impersonation'

interface Params {
  params: Promise<{ id: string }>
}

export async function POST(req: NextRequest, { params }: Params) {
  // Impersonation check — read-only mode
  if (await isImpersonating()) {
    return NextResponse.json(
      { error: 'Impersonation mode is read-only. Stop impersonating to take actions.' },
      { status: 403 },
    )
  }

  const { id: deliverableId } = await params

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

  // Load deliverable and verify client_visible
  const deliverable = await db.deliverable.findUnique({
    where: { id: deliverableId },
    select: {
      id: true,
      project_id: true,
      client_visible: true,
      current_version: true,
    },
  })
  if (!deliverable || !deliverable.client_visible) {
    return NextResponse.json({ message: 'Deliverable not found' }, { status: 404 })
  }

  // Verify user is a participant on the project
  const participant = await db.projectParticipant.findFirst({
    where: {
      person_id: userId,
      project_id: deliverable.project_id,
      project: { client_portal_enabled: true },
    },
  })
  if (!participant) {
    return NextResponse.json({ message: 'Access denied' }, { status: 403 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ message: 'Invalid JSON' }, { status: 400 })
  }

  const { notes, timecodeSeconds, decision } = body as Record<string, unknown>

  // Validate decision value if provided
  if (
    decision !== undefined &&
    decision !== 'approved' &&
    decision !== 'changes_requested'
  ) {
    return NextResponse.json(
      { message: 'decision must be "approved" or "changes_requested"' },
      { status: 400 }
    )
  }

  const isApproved =
    decision === 'approved' ? true : decision === 'changes_requested' ? false : false

  // Create the DeliverableApproval record
  // Schema fields: approver_id, version, approved (Boolean), notes, decided_at
  // plus publication metadata required fields
  const approval = await db.deliverableApproval.create({
    data: {
      deliverable_id: deliverableId,
      approver_id: userId,
      version: deliverable.current_version ?? 1,
      approved: isApproved,
      notes: typeof notes === 'string' ? notes.trim() : '',
      decided_at: new Date(),
      // Publication metadata (required by schema)
      source_bible_id: 0,
      source_bible_table: 'portal',
      published_at: new Date(),
      publication_version: 1,
    },
    include: {
      approver: { select: { name: true } },
    },
  })

  // If a decision was made, update the deliverable's review_status
  if (decision) {
    const newStatus =
      decision === 'approved' ? 'Approved' : 'Changes Requested'
    await db.deliverable.update({
      where: { id: deliverableId },
      data: { review_status: newStatus },
    })
  }

  return NextResponse.json(approval, { status: 201 })
}
