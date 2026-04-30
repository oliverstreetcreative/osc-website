import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock next/headers
vi.mock('next/headers', () => ({
  headers: vi.fn(),
}))

// Mock db
vi.mock('@/lib/db', () => ({
  db: {
    person: { findUnique: vi.fn() },
    portalErrorReport: { create: vi.fn(), findMany: vi.fn() },
    portalEvent: { create: vi.fn() },
  },
}))

import { GET, POST } from '@/app/api/portal/error-reports/route'
import { headers } from 'next/headers'
import { db } from '@/lib/db'

// Typed mocks
const mockHeaders = vi.mocked(headers)
const mockPersonFindUnique = vi.mocked(db.person.findUnique)
const mockReportCreate = vi.mocked(db.portalErrorReport.create)
const mockReportFindMany = vi.mocked(db.portalErrorReport.findMany)
const mockEventCreate = vi.mocked(db.portalEvent.create)

// Helper to build a mock headers object
function makeHeaders(map: Record<string, string | null> = {}) {
  return { get: vi.fn((key: string) => map[key] ?? null) } as any
}

// Helper to build a POST Request
function postRequest(body: unknown) {
  return new Request('http://localhost/api/portal/error-reports', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }) as any
}

// Authenticated person fixture
const authedPerson = { id: 'user-123', name: 'Sam', email: 'sam@example.com', portal_allowed: true }

// Helper: set up valid auth mocks
function setupValidAuth() {
  mockHeaders.mockResolvedValue(makeHeaders({ 'x-user-id': 'user-123' }))
  mockPersonFindUnique.mockResolvedValue(authedPerson as any)
}

beforeEach(() => {
  vi.clearAllMocks()
})

// ---------------------------------------------------------------------------
// POST /api/portal/error-reports
// ---------------------------------------------------------------------------
describe('POST /api/portal/error-reports', () => {
  it('returns 401 when x-user-id header is missing', async () => {
    mockHeaders.mockResolvedValue(makeHeaders())

    const res = await POST(postRequest({ description: 'Test' }))
    const json = await res.json()

    expect(res.status).toBe(401)
    expect(json.error).toBe('Unauthorized')
  })

  it('returns 401 when person not found', async () => {
    mockHeaders.mockResolvedValue(makeHeaders({ 'x-user-id': 'user-123' }))
    mockPersonFindUnique.mockResolvedValue(null)

    const res = await POST(postRequest({ description: 'Test' }))
    const json = await res.json()

    expect(res.status).toBe(401)
    expect(json.error).toBe('Unauthorized')
  })

  it('returns 401 when portal_allowed is false', async () => {
    mockHeaders.mockResolvedValue(makeHeaders({ 'x-user-id': 'user-123' }))
    mockPersonFindUnique.mockResolvedValue({ ...authedPerson, portal_allowed: false } as any)

    const res = await POST(postRequest({ description: 'Test' }))
    const json = await res.json()

    expect(res.status).toBe(401)
    expect(json.error).toBe('Unauthorized')
  })

  it('returns 400 when description is missing', async () => {
    setupValidAuth()

    const res = await POST(postRequest({}))
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error).toBe('description is required')
  })

  it('returns 400 when description is empty string', async () => {
    setupValidAuth()

    const res = await POST(postRequest({ description: '   ' }))
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error).toBe('description is required')
  })

  it('returns 400 when severity is invalid', async () => {
    setupValidAuth()

    const res = await POST(postRequest({ description: 'Test error', severity: 'extreme' }))
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error).toMatch(/Invalid severity/)
    expect(json.error).toMatch(/minor, moderate, blocking/)
  })

  it('returns 201 and creates report + event on happy path', async () => {
    setupValidAuth()

    const fakeReport = {
      id: 'report-abc',
      reporter_id: 'user-123',
      description: 'Something broke',
      severity: 'moderate',
      project_id: null,
      source_table: null,
      source_bible_id: null,
      source_bible_table: null,
      portal_url: null,
      created_at: new Date(),
    }
    mockReportCreate.mockResolvedValue(fakeReport as any)
    mockEventCreate.mockResolvedValue({} as any)

    const res = await POST(postRequest({ description: 'Something broke' }))
    const json = await res.json()

    expect(res.status).toBe(201)
    expect(json.report).toMatchObject({ id: 'report-abc', description: 'Something broke' })

    // Verify portalErrorReport.create was called with correct args
    expect(mockReportCreate).toHaveBeenCalledOnce()
    expect(mockReportCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        reporter_id: 'user-123',
        description: 'Something broke',
        severity: 'moderate', // defaulted
        project_id: null,
        source_table: null,
        source_bible_id: null,
        source_bible_table: null,
        portal_url: null,
      }),
    })

    // Verify portalEvent.create was called with correct args
    expect(mockEventCreate).toHaveBeenCalledOnce()
    expect(mockEventCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        person_id: 'user-123',
        event_type: 'error_flagged',
        source: 'portal_client',
        summary: 'Error report: Something broke',
        details: expect.objectContaining({
          report_id: 'report-abc',
          severity: 'moderate',
          description: 'Something broke',
        }),
      }),
    })
  })

  it('creates report with all optional fields', async () => {
    setupValidAuth()

    const fakeReport = {
      id: 'report-xyz',
      reporter_id: 'user-123',
      description: 'Bible data looks wrong',
      severity: 'blocking',
      project_id: 'proj-1',
      source_table: 'cast',
      source_bible_id: 42,
      source_bible_table: 'bible_cast',
      portal_url: 'https://portal.example.com/cast',
      created_at: new Date(),
    }
    mockReportCreate.mockResolvedValue(fakeReport as any)
    mockEventCreate.mockResolvedValue({} as any)

    const body = {
      description: 'Bible data looks wrong',
      severity: 'blocking',
      project_id: 'proj-1',
      source_table: 'cast',
      source_bible_id: 42,
      source_bible_table: 'bible_cast',
      portal_url: 'https://portal.example.com/cast',
    }

    const res = await POST(postRequest(body))
    const json = await res.json()

    expect(res.status).toBe(201)

    expect(mockReportCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        reporter_id: 'user-123',
        description: 'Bible data looks wrong',
        severity: 'blocking',
        project_id: 'proj-1',
        source_table: 'cast',
        source_bible_id: 42,
        source_bible_table: 'bible_cast',
        portal_url: 'https://portal.example.com/cast',
      }),
    })

    expect(json.report).toMatchObject({ id: 'report-xyz', severity: 'blocking', project_id: 'proj-1' })
  })
})

// ---------------------------------------------------------------------------
// GET /api/portal/error-reports
// ---------------------------------------------------------------------------
describe('GET /api/portal/error-reports', () => {
  it('returns 401 when not authenticated', async () => {
    mockHeaders.mockResolvedValue(makeHeaders())

    const res = await GET()
    const json = await res.json()

    expect(res.status).toBe(401)
    expect(json.error).toBe('Unauthorized')
  })

  it('returns 401 when portal_allowed is false', async () => {
    mockHeaders.mockResolvedValue(makeHeaders({ 'x-user-id': 'user-123' }))
    mockPersonFindUnique.mockResolvedValue({ id: 'user-123', portal_allowed: false } as any)

    const res = await GET()
    const json = await res.json()

    expect(res.status).toBe(401)
    expect(json.error).toBe('Unauthorized')
  })

  it("returns user's reports ordered by created_at desc", async () => {
    mockHeaders.mockResolvedValue(makeHeaders({ 'x-user-id': 'user-123' }))
    mockPersonFindUnique.mockResolvedValue({ id: 'user-123', portal_allowed: true } as any)

    const fakeReports = [
      { id: 'r-2', description: 'Newer error', severity: 'minor', created_at: new Date('2026-04-30'), project: null },
      { id: 'r-1', description: 'Older error', severity: 'moderate', created_at: new Date('2026-04-29'), project: null },
    ]
    mockReportFindMany.mockResolvedValue(fakeReports as any)

    const res = await GET()
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.reports).toHaveLength(2)
    expect(json.reports[0].id).toBe('r-2')
    expect(json.reports[1].id).toBe('r-1')

    expect(mockReportFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { reporter_id: 'user-123' },
        orderBy: { created_at: 'desc' },
        take: 50,
      }),
    )
  })

  it('returns empty array when user has no reports', async () => {
    mockHeaders.mockResolvedValue(makeHeaders({ 'x-user-id': 'user-123' }))
    mockPersonFindUnique.mockResolvedValue({ id: 'user-123', portal_allowed: true } as any)
    mockReportFindMany.mockResolvedValue([] as any)

    const res = await GET()
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.reports).toEqual([])
  })
})
