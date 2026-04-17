import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { db } from '@/lib/db'
import { isImpersonating } from '@/lib/auth/impersonation'

export async function POST(req: NextRequest) {
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

  const person = await db.person.findUnique({
    where: { id: userId },
    select: { id: true, name: true, portal_allowed: true },
  })
  if (!person?.portal_allowed) {
    return NextResponse.json({ message: 'Not authorized' }, { status: 403 })
  }

  const body = await req.json()
  const {
    project_id,
    source_table,
    source_bible_id,
    source_bible_table,
    portal_url,
    description,
    severity,
  } = body as {
    project_id?: string
    source_table?: string
    source_bible_id?: number
    source_bible_table?: string
    portal_url?: string
    description?: string
    severity?: string
  }

  if (!description || typeof description !== 'string' || !description.trim()) {
    return NextResponse.json({ message: 'description is required' }, { status: 400 })
  }

  if (project_id) {
    const participant = await db.projectParticipant.findFirst({
      where: {
        person_id: userId,
        project_id,
        project: { client_portal_enabled: true },
      },
    })
    if (!participant) {
      return NextResponse.json({ message: 'Access denied to this project' }, { status: 403 })
    }
  }

  const report = await db.portalErrorReport.create({
    data: {
      reporter_id: userId,
      project_id: project_id || null,
      source_table: source_table || null,
      source_bible_id: source_bible_id != null ? Number(source_bible_id) : null,
      source_bible_table: source_bible_table || null,
      portal_url: portal_url || null,
      description: description.trim(),
      severity: severity || 'moderate',
    },
  })

  await db.portalEvent.create({
    data: {
      person_id: userId,
      project_id: project_id || null,
      event_type: 'error_flagged',
      summary: `Error report filed by ${person.name}: ${description.trim().slice(0, 100)}`,
      details: { report_id: report.id, severity: report.severity },
      occurred_at: new Date(),
      source_bible_id: 0,
      source_bible_table: 'portal',
      published_at: new Date(),
      publication_version: 1,
    },
  })

  // Create Paperclip issue assigned to Secretary
  try {
    const paperclipUrl = process.env.PAPERCLIP_API_URL || 'http://127.0.0.1:3100'
    const paperclipKey = process.env.PAPERCLIP_API_KEY
    const companyId = process.env.PAPERCLIP_COMPANY_ID
    const secretaryAgentId = process.env.PAPERCLIP_SECRETARY_AGENT_ID

    if (paperclipKey && companyId && secretaryAgentId) {
      const issueRes = await fetch(`${paperclipUrl}/api/companies/${companyId}/issues`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${paperclipKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: `Portal error report: ${description.trim().slice(0, 80)}`,
          description: [
            `**Reporter:** ${person.name} (${userId})`,
            project_id ? `**Project:** ${project_id}` : null,
            source_table ? `**Source table:** ${source_table}` : null,
            source_bible_id != null ? `**Bible ID:** ${source_bible_id}` : null,
            source_bible_table ? `**Bible table:** ${source_bible_table}` : null,
            portal_url ? `**Portal URL:** ${portal_url}` : null,
            `**Severity:** ${report.severity}`,
            `**Description:** ${description.trim()}`,
            `**Report ID:** ${report.id}`,
          ]
            .filter(Boolean)
            .join('\n'),
          status: 'todo',
          priority: report.severity === 'critical' ? 'critical' : 'medium',
          assigneeAgentId: secretaryAgentId,
          parentId: process.env.PAPERCLIP_ERROR_REPORTS_PARENT_ID || undefined,
        }),
      })

      if (issueRes.ok) {
        const issue = await issueRes.json()
        await db.portalErrorReport.update({
          where: { id: report.id },
          data: { paperclip_issue_id: issue.id },
        })
        report.paperclip_issue_id = issue.id
      }
    }
  } catch {
    // Paperclip issue creation is best-effort; report is already persisted
  }

  return NextResponse.json(report, { status: 201 })
}

export async function GET() {
  const hdrs = await headers()
  const userId = hdrs.get('x-user-id')
  if (!userId) {
    return NextResponse.json({ message: 'Not authenticated' }, { status: 401 })
  }

  const person = await db.person.findUnique({
    where: { id: userId },
    select: { id: true, portal_allowed: true },
  })
  if (!person?.portal_allowed) {
    return NextResponse.json({ message: 'Not authorized' }, { status: 403 })
  }

  const reports = await db.portalErrorReport.findMany({
    where: { reporter_id: userId },
    orderBy: { created_at: 'desc' },
  })

  return NextResponse.json(reports)
}
