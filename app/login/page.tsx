'use client'

import { useState, useEffect } from 'react'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'sent' | 'error'>('idle')
  const [note, setNote] = useState('')
  // "Trouble signing in?" (SPEC §29 v2): a report that reaches Sam without a session. No screenshot, no number back.
  const [trouble, setTrouble] = useState<'closed' | 'open' | 'sending' | 'sent' | 'busy' | 'error'>('closed')
  const [troubleText, setTroubleText] = useState('')
  useEffect(() => {
    const q = new URLSearchParams(window.location.search)
    if (q.get('no_account')) setNote('You’re signed in, but no client account is linked to this email yet. Text Sam and he’ll set it up.')
    else if (q.get('signed_out')) setNote('You’re signed out.')
    else if (q.get('demo_ended')) setNote('That demo link has ended. Ask Sam for a new one.')
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setStatus('loading')
    try {
      const res = await fetch('/api/auth/request-magic-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      if (!res.ok) throw new Error()
      setStatus('sent')
    } catch {
      setStatus('error')
    }
  }

  async function sendTrouble(e: React.FormEvent) {
    e.preventDefault()
    if (!troubleText.trim()) return
    setTrouble('sending')
    try {
      const res = await fetch('/support/signin-trouble', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          message: troubleText.slice(0, 2000),
          route: window.location.pathname,
          context: {
            viewport: { w: window.innerWidth, h: window.innerHeight, dpr: window.devicePixelRatio },
            scheme: window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light',
            online: navigator.onLine,
          },
        }),
      })
      setTrouble(res.ok ? 'sent' : res.status === 429 ? 'busy' : 'error')
    } catch {
      setTrouble('error')
    }
  }

  const troubleBlock =
    trouble === 'closed' ? (
      <p className="cs-login-foot">
        <button type="button" onClick={() => setTrouble('open')} style={{ background: 'none', border: 0, color: 'inherit', textDecoration: 'underline', cursor: 'pointer', padding: 0, font: 'inherit' }}>
          Trouble signing in?
        </button>
      </p>
    ) : trouble === 'sent' ? (
      <p className="cs-login-foot" role="status">Thanks: Sam has it. He&rsquo;ll get back to you.</p>
    ) : (
      <form onSubmit={sendTrouble} style={{ marginTop: 18 }}>
        <label htmlFor="cs-trouble" style={{ display: 'block', textAlign: 'left', fontSize: 14, marginBottom: 6 }}>
          What&rsquo;s happening? Sam reads these himself.
        </label>
        <textarea
          id="cs-trouble"
          rows={3}
          maxLength={2000}
          value={troubleText}
          onChange={(e) => setTroubleText(e.target.value)}
          placeholder="The link says it expired…"
          style={{ width: '100%', font: 'inherit', fontSize: 16, padding: '10px 12px', borderRadius: 12, border: '1px solid rgba(247,246,243,0.25)', background: 'transparent', color: 'inherit' }}
        />
        {email ? null : <p style={{ textAlign: 'left', margin: '6px 0 0', fontSize: 13, opacity: 0.8 }}>Put your email above so Sam knows who you are.</p>}
        {trouble === 'busy' || trouble === 'error' ? (
          <p role="alert" style={{ color: '#f2a07a', textAlign: 'left', margin: '6px 0 0' }}>
            {trouble === 'busy' ? 'We\u2019ve got a lot of reports right now.' : 'That didn\u2019t go through.'} Please{' '}
            <a href="sms:+18595121419" style={{ textDecoration: 'underline' }}>text Sam</a>.
          </p>
        ) : null}
        <button type="submit" className="cs-btn light" disabled={!troubleText.trim() || trouble === 'sending'} style={{ marginTop: 10 }}>
          {trouble === 'sending' ? 'Sending…' : 'Send to Sam'}
        </button>
      </form>
    )

  return (
    <div className="cs-login">
      <div className="cs-login-box">
        <a href="/" style={{ display: 'flex', justifyContent: 'center' }}>
          <span className="cs-mark" aria-label="Oliver Street Creative"><b>Oliver Street</b><i>Creative</i></span>
        </a>
        {status === 'sent' ? (
          <>
            <h1>Check your email.</h1>
            <p>We sent a link to {email}. It works once, for 15 minutes.</p>
            <p className="cs-login-foot">
              Nothing arrived? Check spam, or{' '}
              <button onClick={() => setStatus('idle')} style={{ background: 'none', border: 0, color: 'inherit', textDecoration: 'underline', cursor: 'pointer', padding: 0 }}>
                try again
              </button>
              .
            </p>
            {troubleBlock}
          </>
        ) : (
          <>
            <h1>Welcome back.</h1>
            {note ? <p style={{ color: '#f7f6f3' }}>{note}</p> : null}
            <p>Enter your email and we&rsquo;ll send you a sign-in link.</p>
            <form onSubmit={handleSubmit}>
              <input
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="you@yourcompany.com"
                aria-label="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={status === 'loading'}
              />
              {status === 'error' && <p style={{ color: '#f2a07a', textAlign: 'left', margin: 0 }}>That didn&rsquo;t go through. Please try again.</p>}
              <button type="submit" className="cs-btn light" disabled={status === 'loading'}>
                {status === 'loading' ? 'Sending…' : 'Email me a sign-in link'}
              </button>
            </form>
            <p className="cs-login-foot">No password needed. New to Oliver Street? <a href="sms:+18595121419" style={{ textDecoration: 'underline' }}>Text Sam</a>.</p>
            {troubleBlock}
          </>
        )}
      </div>
    </div>
  )
}
