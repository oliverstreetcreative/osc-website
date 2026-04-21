'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import PortalUploader from '@/components/portal/uppy-uploader'

type ProjectAssignment = {
  participantId: string
  role: string
  rateAmount: null
  rateType: null
  project: { id: string; name: string }
}

type RateType = 'hourly' | 'daily' | 'weekly' | 'flat'

export default function SubmitInvoicePage() {
  const [assignments, setAssignments] = useState<ProjectAssignment[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Form state
  const [projectId, setProjectId] = useState('')
  const [role, setRole] = useState('')
  const [rateAmount, setRateAmount] = useState('')
  const [rateType, setRateType] = useState<RateType>('daily')
  const [dateStart, setDateStart] = useState('')
  const [dateEnd, setDateEnd] = useState('')
  const [hoursPerDay, setHoursPerDay] = useState('8')
  const [daysWorked, setDaysWorked] = useState('1')
  const [kitRental, setKitRental] = useState('')
  const [mileage, setMileage] = useState('')
  const [perDiem, setPerDiem] = useState('')
  const [notes, setNotes] = useState('')

  useEffect(() => {
    fetch('/api/crew/projects')
      .then((r) => r.json())
      .then((data: ProjectAssignment[]) => {
        setAssignments(data)
        setLoading(false)
      })
      .catch(() => {
        setError('Failed to load projects.')
        setLoading(false)
      })
  }, [])

  // When project changes, pre-fill role
  function handleProjectChange(id: string) {
    setProjectId(id)
    const assignment = assignments.find((a) => a.project.id === id)
    if (assignment) {
      setRole(assignment.role || '')
    }
  }

  // Live total calculation
  function calcTotal(): number {
    const rate = parseFloat(rateAmount) || 0
    const days = parseFloat(daysWorked) || 0
    const hours = parseFloat(hoursPerDay) || 0
    const kit = parseFloat(kitRental) || 0
    const miles = parseFloat(mileage) || 0
    const pd = parseFloat(perDiem) || 0

    let base = 0
    if (rateType === 'hourly') {
      base = rate * hours * days
    } else if (rateType === 'daily') {
      base = rate * days
    } else if (rateType === 'weekly') {
      base = rate * (days / 5)
    } else if (rateType === 'flat') {
      base = rate
    }

    const mileagePay = miles * 0.70

    return base + kit + mileagePay + pd
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!projectId) {
      setError('Please select a project.')
      return
    }

    const assignment = assignments.find((a) => a.project.id === projectId)
    const total = calcTotal()

    setSubmitting(true)
    try {
      const res = await fetch('/api/crew/invoices/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          projectName: assignment?.project.name ?? '',
          role,
          rateAmount: parseFloat(rateAmount) || 0,
          rateType,
          dateStart,
          dateEnd,
          hoursPerDay: parseFloat(hoursPerDay) || 0,
          daysWorked: parseFloat(daysWorked) || 0,
          kitRental: parseFloat(kitRental) || 0,
          mileage: parseFloat(mileage) || 0,
          perDiem: parseFloat(perDiem) || 0,
          notes,
          total,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.message || 'Submission failed.')
      } else {
        setSubmitted(true)
      }
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '9px 12px',
    background: 'rgba(247,246,243,0.06)',
    border: '1px solid rgba(138,138,132,0.25)',
    borderRadius: '6px',
    color: 'var(--paper)',
    fontSize: '14px',
    outline: 'none',
    boxSizing: 'border-box',
  }

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: '11px',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    color: 'var(--quiet)',
    marginBottom: '6px',
  }

  const fieldStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: '0',
  }

  if (submitted) {
    return (
      <div style={{ maxWidth: '600px' }}>
        <div
          style={{
            padding: '40px',
            background: 'rgba(58,138,92,0.05)',
            border: '1px solid rgba(58,138,92,0.3)',
            borderRadius: '12px',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: '32px', marginBottom: '16px' }}>✓</div>
          <h2
            style={{
              fontFamily: 'var(--font-inter)',
              fontWeight: 700,
              fontSize: '20px',
              color: 'var(--green)',
              marginBottom: '8px',
            }}
          >
            Invoice Submitted
          </h2>
          <p style={{ color: 'var(--quiet)', fontSize: '14px', marginBottom: '24px' }}>
            Your invoice has been submitted for review. You'll be notified when it's processed.
          </p>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
            <Link
              href="/crew/invoices"
              style={{
                display: 'inline-block',
                padding: '8px 20px',
                background: 'var(--gold)',
                color: '#111',
                fontWeight: 700,
                fontSize: '13px',
                borderRadius: '6px',
                textDecoration: 'none',
              }}
            >
              View Invoice History
            </Link>
            <button
              onClick={() => {
                setSubmitted(false)
                setProjectId('')
                setRole('')
                setRateAmount('')
                setRateType('daily')
                setDateStart('')
                setDateEnd('')
                setHoursPerDay('8')
                setDaysWorked('1')
                setKitRental('')
                setMileage('')
                setPerDiem('')
                setNotes('')
              }}
              style={{
                padding: '8px 20px',
                background: 'transparent',
                border: '1px solid rgba(138,138,132,0.3)',
                color: 'var(--paper)',
                fontSize: '13px',
                fontWeight: 600,
                borderRadius: '6px',
                cursor: 'pointer',
              }}
            >
              Submit Another
            </button>
          </div>
        </div>
      </div>
    )
  }

  const total = calcTotal()

  return (
    <div style={{ maxWidth: '700px' }}>
      <h1
        style={{
          fontFamily: 'var(--font-inter)',
          fontWeight: 900,
          fontSize: 'clamp(22px, 3vw, 30px)',
          letterSpacing: '-0.02em',
          marginBottom: '28px',
        }}
      >
        Submit Invoice
      </h1>

      {loading ? (
        <p style={{ color: 'var(--quiet)' }}>Loading projects...</p>
      ) : (
        <form onSubmit={handleSubmit}>
          {error && (
            <div
              style={{
                padding: '12px 16px',
                background: 'rgba(220,38,38,0.1)',
                border: '1px solid rgba(220,38,38,0.3)',
                borderRadius: '8px',
                color: 'var(--red)',
                fontSize: '14px',
                marginBottom: '20px',
              }}
            >
              {error}
            </div>
          )}

          {/* Project */}
          <div style={{ ...fieldStyle, marginBottom: '20px' }}>
            <label style={labelStyle}>Project *</label>
            <select
              value={projectId}
              onChange={(e) => handleProjectChange(e.target.value)}
              required
              style={{ ...inputStyle, cursor: 'pointer' }}
            >
              <option value="">Select a project...</option>
              {assignments.map((a) => (
                <option key={a.project.id} value={a.project.id}>
                  {a.project.name}
                </option>
              ))}
            </select>
          </div>

          {/* Role */}
          <div style={{ ...fieldStyle, marginBottom: '20px' }}>
            <label style={labelStyle}>Role</label>
            <input
              type="text"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              placeholder="e.g. Director of Photography"
              style={inputStyle}
            />
          </div>

          {/* Rate */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '16px',
              marginBottom: '20px',
            }}
          >
            <div style={fieldStyle}>
              <label style={labelStyle}>Rate Amount ($)</label>
              <input
                type="number"
                value={rateAmount}
                onChange={(e) => setRateAmount(e.target.value)}
                placeholder="0.00"
                min="0"
                step="0.01"
                style={inputStyle}
              />
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>Rate Type</label>
              <select
                value={rateType}
                onChange={(e) => setRateType(e.target.value as RateType)}
                style={{ ...inputStyle, cursor: 'pointer' }}
              >
                <option value="hourly">Hourly</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="flat">Flat</option>
              </select>
            </div>
          </div>

          {/* Dates */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '16px',
              marginBottom: '20px',
            }}
          >
            <div style={fieldStyle}>
              <label style={labelStyle}>Start Date</label>
              <input
                type="date"
                value={dateStart}
                onChange={(e) => setDateStart(e.target.value)}
                style={inputStyle}
              />
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>End Date</label>
              <input
                type="date"
                value={dateEnd}
                onChange={(e) => setDateEnd(e.target.value)}
                style={inputStyle}
              />
            </div>
          </div>

          {/* Days / Hours */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '16px',
              marginBottom: '20px',
            }}
          >
            <div style={fieldStyle}>
              <label style={labelStyle}>Days Worked</label>
              <input
                type="number"
                value={daysWorked}
                onChange={(e) => setDaysWorked(e.target.value)}
                min="0"
                step="0.5"
                style={inputStyle}
              />
            </div>
            {rateType === 'hourly' && (
              <div style={fieldStyle}>
                <label style={labelStyle}>Hours Per Day</label>
                <input
                  type="number"
                  value={hoursPerDay}
                  onChange={(e) => setHoursPerDay(e.target.value)}
                  min="0"
                  step="0.5"
                  style={inputStyle}
                />
              </div>
            )}
          </div>

          {/* Additional expenses */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '16px',
              marginBottom: '20px',
            }}
          >
            <div style={fieldStyle}>
              <label style={labelStyle}>Kit Rental ($)</label>
              <input
                type="number"
                value={kitRental}
                onChange={(e) => setKitRental(e.target.value)}
                placeholder="0.00"
                min="0"
                step="0.01"
                style={inputStyle}
              />
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>Mileage (mi)</label>
              <input
                type="number"
                value={mileage}
                onChange={(e) => setMileage(e.target.value)}
                placeholder="0"
                min="0"
                step="1"
                style={inputStyle}
              />
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>Per Diem ($)</label>
              <input
                type="number"
                value={perDiem}
                onChange={(e) => setPerDiem(e.target.value)}
                placeholder="0.00"
                min="0"
                step="0.01"
                style={inputStyle}
              />
            </div>
          </div>

          {/* Notes */}
          <div style={{ ...fieldStyle, marginBottom: '28px' }}>
            <label style={labelStyle}>Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any additional notes or details..."
              rows={3}
              style={{ ...inputStyle, resize: 'vertical' }}
            />
          </div>

          {/* Invoice PDF upload */}
          {projectId && (
            <div style={{ marginBottom: '28px' }}>
              <label style={labelStyle}>Attach Invoice PDF (optional)</label>
              <p style={{ fontSize: '12px', color: 'var(--quiet)', marginBottom: '12px' }}>
                Upload a PDF invoice if you have one prepared.
              </p>
              <PortalUploader
                projectId={projectId}
                uploadContext="invoice"
                maxFileSize={50 * 1024 * 1024}
                onUploadComplete={(result) => {
                  setNotes((prev) =>
                    prev
                      ? `${prev}\n\nAttached: ${result.filename}`
                      : `Attached: ${result.filename}`
                  )
                }}
              />
            </div>
          )}

          {/* Live total */}
          <div
            style={{
              padding: '16px 20px',
              background: 'rgba(242,193,78,0.07)',
              border: '1px solid rgba(242,193,78,0.2)',
              borderRadius: '8px',
              marginBottom: '24px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div>
              <div
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  color: 'var(--quiet)',
                  marginBottom: '2px',
                }}
              >
                Estimated Total
              </div>
              {parseFloat(mileage) > 0 && (
                <div style={{ fontSize: '11px', color: 'var(--quiet)' }}>
                  Mileage at $0.70/mile
                </div>
              )}
            </div>
            <div
              style={{
                fontSize: '24px',
                fontWeight: 700,
                color: 'var(--gold)',
              }}
            >
              ${total.toFixed(2)}
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={submitting}
            style={{
              padding: '10px 28px',
              background: submitting ? 'rgba(242,193,78,0.4)' : 'var(--gold)',
              color: '#111',
              fontSize: '14px',
              fontWeight: 700,
              borderRadius: '6px',
              border: 'none',
              cursor: submitting ? 'not-allowed' : 'pointer',
            }}
          >
            {submitting ? 'Submitting...' : 'Submit Invoice'}
          </button>
        </form>
      )}
    </div>
  )
}
