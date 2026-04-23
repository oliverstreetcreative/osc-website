'use client'

import React, { useState } from 'react'

// ---------------------------------------------------------------------------
// Types (mirror Prisma shape passed from server)
// ---------------------------------------------------------------------------
export type ReportRow = {
  id: string
  description: string
  severity: string
  status: string
  created_at: Date
  resolution_notes: string | null
  portal_url: string | null
  reporter: { id: string; name: string; email: string }
  project: { id: string; name: string } | null
}

// ---------------------------------------------------------------------------
// Badge helpers
// ---------------------------------------------------------------------------
function statusStyle(status: string): React.CSSProperties {
  switch (status) {
    case 'open':
      return {
        background: 'rgba(242,193,78,0.12)',
        color: '#f2c14e',
        border: '1px solid rgba(242,193,78,0.35)',
      }
    case 'triaged':
    case 'in_progress':
      return {
        background: 'rgba(100,160,240,0.12)',
        color: '#64a0f0',
        border: '1px solid rgba(100,160,240,0.35)',
      }
    case 'resolved':
      return {
        background: 'rgba(58,138,92,0.12)',
        color: '#3a8a5c',
        border: '1px solid rgba(58,138,92,0.35)',
      }
    case 'invalid':
    case 'closed':
    default:
      return {
        background: 'rgba(138,138,132,0.12)',
        color: 'var(--quiet)',
        border: '1px solid rgba(138,138,132,0.25)',
      }
  }
}

function severityStyle(severity: string): React.CSSProperties {
  switch (severity) {
    case 'blocking':
      return {
        background: 'rgba(224,92,92,0.12)',
        color: '#e05c5c',
        border: '1px solid rgba(224,92,92,0.35)',
      }
    case 'moderate':
      return {
        background: 'rgba(242,193,78,0.12)',
        color: '#f2c14e',
        border: '1px solid rgba(242,193,78,0.35)',
      }
    case 'minor':
    default:
      return {
        background: 'rgba(138,138,132,0.12)',
        color: 'var(--quiet)',
        border: '1px solid rgba(138,138,132,0.25)',
      }
  }
}

function Badge({
  children,
  extraStyle,
}: {
  children: React.ReactNode
  extraStyle: React.CSSProperties
}) {
  return (
    <span
      style={{
        display: 'inline-block',
        fontSize: '10px',
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        padding: '2px 8px',
        borderRadius: '4px',
        whiteSpace: 'nowrap',
        ...extraStyle,
      }}
    >
      {children}
    </span>
  )
}

function formatDate(d: Date): string {
  return new Date(d).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

// ---------------------------------------------------------------------------
// Filter tabs
// ---------------------------------------------------------------------------
const TABS = ['all', 'open', 'triaged', 'in_progress', 'resolved'] as const
type Tab = (typeof TABS)[number]

const TAB_LABELS: Record<Tab, string> = {
  all: 'All',
  open: 'Open',
  triaged: 'Triaged',
  in_progress: 'In Progress',
  resolved: 'Resolved',
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export function ErrorReportTable({ reports }: { reports: ReportRow[] }) {
  const [activeTab, setActiveTab] = useState<Tab>('all')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const filtered =
    activeTab === 'all'
      ? reports
      : reports.filter((r) => r.status === activeTab)

  function toggleRow(id: string) {
    setExpandedId((prev) => (prev === id ? null : id))
  }

  return (
    <div>
      {/* Filter tabs */}
      <div
        style={{
          display: 'flex',
          gap: '4px',
          marginBottom: '20px',
          borderBottom: '1px solid rgba(138,138,132,0.2)',
          paddingBottom: '0',
        }}
      >
        {TABS.map((tab) => {
          const count =
            tab === 'all'
              ? reports.length
              : reports.filter((r) => r.status === tab).length
          const isActive = tab === activeTab
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '8px 14px',
                fontSize: '13px',
                fontWeight: isActive ? 700 : 500,
                color: isActive ? 'var(--paper)' : 'var(--quiet)',
                borderBottom: isActive
                  ? '2px solid var(--paper)'
                  : '2px solid transparent',
                marginBottom: '-1px',
                transition: 'color 0.15s',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              {TAB_LABELS[tab]}
              {count > 0 && (
                <span
                  style={{
                    fontSize: '10px',
                    fontWeight: 700,
                    color: isActive ? 'var(--paper)' : 'rgba(138,138,132,0.6)',
                    background: isActive
                      ? 'rgba(247,246,243,0.12)'
                      : 'rgba(138,138,132,0.1)',
                    padding: '1px 6px',
                    borderRadius: '10px',
                  }}
                >
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <p style={{ fontSize: '14px', color: 'var(--quiet)', padding: '32px 0' }}>
          No reports match this filter.
        </p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(138,138,132,0.25)' }}>
              {['Reporter', 'Project', 'Description', 'Severity', 'Status', 'Created'].map(
                (h) => (
                  <th
                    key={h}
                    style={{
                      padding: '8px 12px',
                      textAlign: 'left',
                      fontSize: '10px',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.1em',
                      color: 'var(--quiet)',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {h}
                  </th>
                )
              )}
            </tr>
          </thead>
          <tbody>
            {filtered.map((report) => {
              const isExpanded = expandedId === report.id
              const hasNotes = !!report.resolution_notes

              return (
                <React.Fragment key={report.id}>
                  <tr
                    onClick={() => toggleRow(report.id)}
                    style={{
                      borderBottom: isExpanded
                        ? 'none'
                        : '1px solid rgba(138,138,132,0.08)',
                      cursor: 'pointer',
                      background: isExpanded ? 'rgba(247,246,243,0.04)' : 'transparent',
                      transition: 'background 0.1s',
                    }}
                  >
                    {/* Reporter */}
                    <td style={{ padding: '12px 12px', verticalAlign: 'top' }}>
                      <div
                        style={{
                          fontSize: '13px',
                          fontWeight: 600,
                          color: 'var(--paper)',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {report.reporter.name}
                      </div>
                      <div
                        style={{
                          fontSize: '11px',
                          color: 'var(--quiet)',
                          marginTop: '2px',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {report.reporter.email}
                      </div>
                    </td>

                    {/* Project */}
                    <td
                      style={{
                        padding: '12px 12px',
                        fontSize: '13px',
                        color: 'var(--quiet)',
                        verticalAlign: 'top',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {report.project?.name ?? (
                        <span style={{ color: 'rgba(138,138,132,0.4)' }}>—</span>
                      )}
                    </td>

                    {/* Description */}
                    <td
                      style={{
                        padding: '12px 12px',
                        fontSize: '13px',
                        color: 'var(--paper)',
                        verticalAlign: 'top',
                        maxWidth: '340px',
                      }}
                    >
                      <span
                        style={{
                          display: '-webkit-box',
                          WebkitLineClamp: isExpanded ? 'unset' : 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: isExpanded ? 'visible' : 'hidden',
                          lineHeight: '1.5',
                        }}
                      >
                        {report.description}
                      </span>
                    </td>

                    {/* Severity */}
                    <td style={{ padding: '12px 12px', verticalAlign: 'top' }}>
                      <Badge extraStyle={severityStyle(report.severity)}>
                        {report.severity}
                      </Badge>
                    </td>

                    {/* Status */}
                    <td style={{ padding: '12px 12px', verticalAlign: 'top' }}>
                      <Badge extraStyle={statusStyle(report.status)}>
                        {report.status.replace('_', ' ')}
                      </Badge>
                    </td>

                    {/* Created */}
                    <td
                      style={{
                        padding: '12px 12px',
                        fontSize: '12px',
                        color: 'var(--quiet)',
                        verticalAlign: 'top',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {formatDate(report.created_at)}
                        <span
                          style={{
                            fontSize: '10px',
                            color: 'rgba(138,138,132,0.5)',
                            transition: 'transform 0.15s',
                            display: 'inline-block',
                            transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                          }}
                        >
                          ▾
                        </span>
                      </div>
                    </td>
                  </tr>

                  {/* Expanded details row */}
                  {isExpanded && (
                    <tr
                      key={`${report.id}-expanded`}
                      style={{
                        borderBottom: '1px solid rgba(138,138,132,0.08)',
                        background: 'rgba(247,246,243,0.04)',
                      }}
                    >
                      <td
                        colSpan={6}
                        style={{ padding: '0 12px 16px 12px' }}
                      >
                        <div
                          style={{
                            borderTop: '1px solid rgba(138,138,132,0.1)',
                            paddingTop: '12px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '10px',
                          }}
                        >
                          {report.portal_url && (
                            <div>
                              <span
                                style={{
                                  fontSize: '10px',
                                  fontWeight: 700,
                                  textTransform: 'uppercase',
                                  letterSpacing: '0.1em',
                                  color: 'var(--quiet)',
                                  marginRight: '8px',
                                }}
                              >
                                URL
                              </span>
                              <span
                                style={{
                                  fontSize: '12px',
                                  color: 'rgba(138,138,132,0.7)',
                                  fontFamily: 'monospace',
                                  wordBreak: 'break-all',
                                }}
                              >
                                {report.portal_url}
                              </span>
                            </div>
                          )}

                          {hasNotes ? (
                            <div>
                              <div
                                style={{
                                  fontSize: '10px',
                                  fontWeight: 700,
                                  textTransform: 'uppercase',
                                  letterSpacing: '0.1em',
                                  color: 'var(--quiet)',
                                  marginBottom: '6px',
                                }}
                              >
                                Resolution Notes
                              </div>
                              <div
                                style={{
                                  fontSize: '13px',
                                  color: 'var(--paper)',
                                  lineHeight: '1.6',
                                  whiteSpace: 'pre-wrap',
                                  background: 'rgba(138,138,132,0.06)',
                                  border: '1px solid rgba(138,138,132,0.15)',
                                  borderRadius: '6px',
                                  padding: '10px 14px',
                                  maxWidth: '700px',
                                }}
                              >
                                {report.resolution_notes}
                              </div>
                            </div>
                          ) : (
                            <p
                              style={{
                                fontSize: '12px',
                                color: 'rgba(138,138,132,0.5)',
                                fontStyle: 'italic',
                              }}
                            >
                              No resolution notes yet.
                            </p>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              )
            })}
          </tbody>
        </table>
      )}
    </div>
  )
}
