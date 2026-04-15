'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'

interface TestimonialFormProps {
  projectId: string
  projectName: string
}

export function TestimonialForm({ projectId, projectName }: TestimonialFormProps) {
  const [quoteText, setQuoteText] = useState('')
  const [context, setContext] = useState('')
  const [permissionGranted, setPermissionGranted] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [submittedQuote, setSubmittedQuote] = useState('')

  if (submitted) {
    return (
      <div
        style={{
          textAlign: 'center',
          padding: '40px 0',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '16px',
        }}
      >
        <div
          style={{
            width: '48px',
            height: '48px',
            borderRadius: '50%',
            background: 'var(--green)',
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '20px',
            fontWeight: 700,
          }}
        >
          ✓
        </div>
        <h2
          style={{
            fontFamily: 'var(--font-inter)',
            fontWeight: 900,
            fontSize: '22px',
            letterSpacing: '-0.02em',
          }}
        >
          Thank You!
        </h2>
        <p style={{ fontSize: '14px', color: 'var(--quiet)' }}>
          Your testimonial for <strong style={{ color: 'var(--paper)' }}>{projectName}</strong> has
          been received.
        </p>
        <blockquote
          style={{
            borderLeft: '3px solid var(--green)',
            paddingLeft: '16px',
            fontStyle: 'italic',
            fontSize: '15px',
            color: 'var(--quiet)',
            lineHeight: 1.65,
            textAlign: 'left',
            maxWidth: '480px',
          }}
        >
          "{submittedQuote}"
        </blockquote>
        <p style={{ fontSize: '12px', color: 'var(--faint)', fontStyle: 'italic' }}>
          {permissionGranted
            ? 'You have granted permission to use this testimonial in marketing materials.'
            : 'Permission to use in marketing materials was not granted.'}
        </p>
      </div>
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const text = quoteText.trim()
    if (!text) return

    setSubmitting(true)
    setError('')

    try {
      const res = await fetch('/api/portal/testimonials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          quoteText: text,
          context: context.trim(),
          permissionStatus: permissionGranted ? 'granted' : 'denied',
        }),
      })

      if (res.ok) {
        setSubmittedQuote(text)
        setSubmitted(true)
      } else {
        const body = await res.json().catch(() => ({}))
        setError(body.message || 'Something went wrong. Please try again.')
      }
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}
    >
      {error && (
        <div
          role="alert"
          style={{
            background: 'rgba(209,59,46,0.1)',
            border: '1px solid var(--red)',
            borderRadius: '6px',
            padding: '12px 16px',
            fontSize: '14px',
            color: 'var(--red)',
          }}
        >
          {error}
        </div>
      )}

      {/* Quote text */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <label
          htmlFor="quoteText"
          style={{ fontSize: '14px', fontWeight: 600, color: 'var(--paper)' }}
        >
          Your Testimonial <span style={{ color: 'var(--orange)' }}>*</span>
        </label>
        <Textarea
          id="quoteText"
          value={quoteText}
          onChange={(e) => setQuoteText(e.target.value)}
          placeholder="Tell us about your experience working with Oliver Street Creative..."
          rows={5}
          required
          style={{
            background: 'rgba(247,246,243,0.06)',
            border: '1px solid rgba(138,138,132,0.3)',
            color: 'var(--paper)',
            fontSize: '15px',
          }}
        />
      </div>

      {/* Context */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <label
          htmlFor="context"
          style={{ fontSize: '14px', fontWeight: 600, color: 'var(--paper)' }}
        >
          Project Context{' '}
          <span style={{ fontWeight: 400, fontSize: '13px', color: 'var(--quiet)' }}>
            (optional)
          </span>
        </label>
        <Input
          id="context"
          type="text"
          value={context}
          onChange={(e) => setContext(e.target.value)}
          placeholder="e.g., Brand film, commercial shoot"
          style={{
            background: 'rgba(247,246,243,0.06)',
            border: '1px solid rgba(138,138,132,0.3)',
            color: 'var(--paper)',
            fontSize: '15px',
          }}
        />
      </div>

      {/* Permission checkbox */}
      <label
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: '10px',
          cursor: 'pointer',
          fontSize: '14px',
          color: 'var(--paper)',
          lineHeight: 1.5,
        }}
      >
        <input
          type="checkbox"
          checked={permissionGranted}
          onChange={(e) => setPermissionGranted(e.target.checked)}
          style={{
            marginTop: '2px',
            width: '16px',
            height: '16px',
            flexShrink: 0,
            accentColor: 'var(--orange)',
            cursor: 'pointer',
          }}
        />
        <span>
          I give permission to use this testimonial on Oliver Street Creative's website and
          marketing materials.
        </span>
      </label>

      <Button
        type="submit"
        disabled={submitting || !quoteText.trim()}
        style={{
          background: 'var(--orange)',
          color: 'var(--ink)',
          fontWeight: 700,
          alignSelf: 'flex-start',
          padding: '10px 28px',
        }}
      >
        {submitting ? 'Submitting…' : 'Submit Testimonial'}
      </Button>
    </form>
  )
}
