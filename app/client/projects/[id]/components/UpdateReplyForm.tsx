'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'

interface UpdateReplyFormProps {
  updateId: string
  projectId: string
}

export function UpdateReplyForm({ updateId, projectId }: UpdateReplyFormProps) {
  const [open, setOpen] = useState(false)
  const [reply, setReply] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  if (success) {
    return (
      <p style={{ fontSize: '13px', color: 'var(--green)', marginTop: '8px' }}>
        Reply sent. Thank you.
      </p>
    )
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          fontSize: '12px',
          color: 'var(--quiet)',
          padding: '4px 0',
          marginTop: '6px',
        }}
      >
        Reply →
      </button>
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const text = reply.trim()
    if (text.length < 2) return

    setSubmitting(true)
    setError('')

    try {
      const res = await fetch(`/api/portal/projects/${projectId}/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updateId, reply: text }),
      })

      if (res.ok) {
        setSuccess(true)
      } else {
        const body = await res.json().catch(() => ({}))
        setError(body.message || 'Something went wrong.')
      }
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <Textarea
        value={reply}
        onChange={(e) => setReply(e.target.value)}
        placeholder="Write a reply..."
        rows={3}
        style={{
          background: 'rgba(247,246,243,0.06)',
          border: '1px solid rgba(138,138,132,0.3)',
          color: 'var(--paper)',
          fontSize: '14px',
        }}
      />
      {error && (
        <p style={{ fontSize: '12px', color: 'var(--red)' }}>{error}</p>
      )}
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        <Button type="submit" size="sm" disabled={submitting || reply.trim().length < 2}>
          {submitting ? 'Sending…' : 'Send Reply'}
        </Button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontSize: '12px',
            color: 'var(--quiet)',
            padding: '0',
          }}
        >
          Cancel
        </button>
      </div>
    </form>
  )
}
