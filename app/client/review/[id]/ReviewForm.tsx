'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { formatTimecode } from '@/lib/portal-utils'

interface ReviewFormProps {
  deliverableId: string
  videoRef?: React.RefObject<HTMLVideoElement | null>
}

export function ReviewForm({ deliverableId, videoRef }: ReviewFormProps) {
  const router = useRouter()
  const [notes, setNotes] = useState('')
  const [timecodeSeconds, setTimecodeSeconds] = useState<number | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  async function submit(decision?: 'approved' | 'changes_requested') {
    setError(null)
    setSuccessMsg(null)

    if (!notes.trim() && !decision) {
      setError('Please enter a note or choose a decision.')
      return
    }

    if (decision) {
      const label = decision === 'approved' ? 'approve this deliverable' : 'request changes'
      if (!window.confirm(`Are you sure you want to ${label}?`)) return
    }

    setSubmitting(true)
    try {
      const res = await fetch(`/api/portal/deliverables/${deliverableId}/reviews`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notes: notes.trim() || undefined,
          timecodeSeconds: timecodeSeconds ?? undefined,
          decision,
        }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.message || `Request failed (${res.status})`)
      }

      if (decision === 'approved') {
        setSuccessMsg('Deliverable approved. Thank you!')
      } else if (decision === 'changes_requested') {
        setSuccessMsg('Change request submitted. We\'ll follow up shortly.')
      } else {
        setSuccessMsg('Note added.')
      }

      setNotes('')
      setTimecodeSeconds(null)
      router.refresh()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setSubmitting(false)
    }
  }

  function captureTimecode() {
    // Try to find the video element from the ref or fall back to document query
    const video =
      videoRef?.current ??
      (document.querySelector('video') as HTMLVideoElement | null)
    if (video) {
      setTimecodeSeconds(Math.floor(video.currentTime))
    }
  }

  return (
    <div>
      {/* Add a note */}
      <div style={{ marginBottom: '12px' }}>
        <Textarea
          placeholder="Add a note or feedback…"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          disabled={submitting}
          style={{
            background: 'rgba(247,246,243,0.06)',
            border: '1px solid rgba(138,138,132,0.3)',
            color: 'var(--paper)',
            borderRadius: '6px',
            fontSize: '14px',
            resize: 'vertical',
            width: '100%',
          }}
        />
      </div>

      {/* Timecode capture row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          marginBottom: '12px',
        }}
      >
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={captureTimecode}
          disabled={submitting}
          style={{
            fontSize: '12px',
            color: 'var(--quiet)',
            borderColor: 'rgba(138,138,132,0.3)',
            background: 'transparent',
          }}
        >
          Mark Timecode
        </Button>
        {timecodeSeconds !== null && (
          <span style={{ fontSize: '12px', color: 'var(--gold)', fontFamily: 'monospace' }}>
            @ {formatTimecode(timecodeSeconds)}
            <button
              type="button"
              onClick={() => setTimecodeSeconds(null)}
              disabled={submitting}
              style={{
                marginLeft: '6px',
                fontSize: '11px',
                color: 'var(--quiet)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '0',
              }}
            >
              ✕
            </button>
          </span>
        )}
      </div>

      {/* Add Note submit */}
      <Button
        type="button"
        onClick={() => submit()}
        disabled={submitting || !notes.trim()}
        style={{
          fontSize: '13px',
          fontWeight: 600,
          marginBottom: '20px',
          background: 'rgba(247,246,243,0.1)',
          color: 'var(--paper)',
          border: '1px solid rgba(138,138,132,0.3)',
        }}
      >
        {submitting ? 'Submitting…' : 'Add Note'}
      </Button>

      {/* Divider */}
      <div
        style={{
          borderTop: '1px solid rgba(138,138,132,0.15)',
          margin: '4px 0 20px',
        }}
      />

      {/* Decision buttons */}
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        <Button
          type="button"
          onClick={() => submit('approved')}
          disabled={submitting}
          style={{
            fontSize: '13px',
            fontWeight: 700,
            background: 'rgba(58,138,92,0.15)',
            color: 'var(--green)',
            border: '1px solid rgba(58,138,92,0.4)',
          }}
        >
          Approve Deliverable
        </Button>
        <Button
          type="button"
          onClick={() => submit('changes_requested')}
          disabled={submitting}
          style={{
            fontSize: '13px',
            fontWeight: 700,
            background: 'rgba(242,193,78,0.1)',
            color: 'var(--gold)',
            border: '1px solid rgba(242,193,78,0.35)',
          }}
        >
          Request Changes
        </Button>
      </div>

      {/* Feedback messages */}
      {error && (
        <p
          style={{
            marginTop: '12px',
            fontSize: '13px',
            color: 'var(--red)',
          }}
        >
          {error}
        </p>
      )}
      {successMsg && (
        <p
          style={{
            marginTop: '12px',
            fontSize: '13px',
            color: 'var(--green)',
          }}
        >
          {successMsg}
        </p>
      )}
    </div>
  )
}
