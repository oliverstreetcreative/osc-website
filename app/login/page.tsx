'use client'
// Sign in (SPEC §27 P0 v2): ask for a link (it signs in THIS browser: the one that asked), or type the 6-digit code
// from the same email (any device: a laptop, the mail app's own browser, the hub's home-screen app). "Trouble signing
// in?" reaches Sam without a session (SPEC §29 v2).

import { useState, useEffect } from 'react'

const linkStyle = { background: 'none', border: 0, color: 'inherit', textDecoration: 'underline', cursor: 'pointer', padding: 0, font: 'inherit' } as const

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'sent' | 'error'>('idle')
  const [note, setNote] = useState('')
  const [redirect, setRedirect] = useState<string | null>(null)
  // The code: shown after sending, or straight away when someone arrives from a link opened on another device.
  const [codeMode, setCodeMode] = useState(false)
  const [code, setCode] = useState('')
  const [codeStatus, setCodeStatus] = useState<'idle' | 'checking' | 'wrong' | 'too_many' | 'error'>('idle')
  // "Trouble signing in?" (SPEC §29 v2): a report that reaches Sam without a session. No screenshot, no number back.
  const [trouble, setTrouble] = useState<'closed' | 'open' | 'sending' | 'sent' | 'busy' | 'error'>('closed')
  const [troubleText, setTroubleText] = useState('')
  useEffect(() => {
    const q = new URLSearchParams(window.location.search)
    setRedirect(q.get('redirect'))
    if (q.get('no_account')) setNote('You’re signed in, but no client account is linked to this email yet. Text Sam and he’ll set it up.')
    else if (q.get('signed_out')) setNote('You’re signed out.')
    else if (q.get('demo_ended')) setNote('That demo link has ended. Ask Sam for a new one.')
    else if (q.get('link') === 'used') setNote('That link was already used or has expired. Ask for a new one below.')
    else if (q.get('link') === 'invalid') setNote('That link didn’t work here. Ask for a new one below.')
    if (q.get('code')) {
      setCodeMode(true)
      setNote('To sign in on this device, type the 6-digit code from the email.')
    }
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setStatus('loading')
    try {
      const res = await fetch('/api/auth/request-magic-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, redirect }),
      })
      if (!res.ok) throw new Error()
      setStatus('sent')
      setCodeMode(true)
      setCode('')
      setCodeStatus('idle')
    } catch {
      setStatus('error')
    }
  }

  async function submitCode(e: React.FormEvent) {
    e.preventDefault()
    setCodeStatus('checking')
    try {
      const res = await fetch('/api/auth/code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code, redirect }),
      })
      const body = (await res.json().catch(() => ({}))) as { redirectTo?: string; error?: string }
      if (res.ok && body.redirectTo) {
        window.location.href = body.redirectTo
        return
      }
      setCodeStatus(res.status === 429 ? 'too_many' : res.status === 400 ? 'wrong' : 'error')
    } catch {
      setCodeStatus('error')
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
        <button type="button" onClick={() => setTrouble('open')} style={linkStyle}>
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
            {trouble === 'busy' ? 'We’ve got a lot of reports right now.' : 'That didn’t go through.'} Please{' '}
            <a href="sms:+18595121419" style={{ textDecoration: 'underline' }}>text Sam</a>.
          </p>
        ) : null}
        <button type="submit" className="cs-btn light" disabled={!troubleText.trim() || trouble === 'sending'} style={{ marginTop: 10 }}>
          {trouble === 'sending' ? 'Sending…' : 'Send to Sam'}
        </button>
      </form>
    )

  const codeForm = (
    <form onSubmit={submitCode} style={{ marginTop: 14 }}>
      {status === 'sent' ? null : (
        <input
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="you@yourcompany.com"
          aria-label="Email address"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      )}
      <input
        type="text"
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9 -]*"
        maxLength={7}
        placeholder="123 456"
        aria-label="The 6-digit code from the email"
        value={code}
        onChange={(e) => setCode(e.target.value)}
        required
        style={{ letterSpacing: 4, fontSize: 22, textAlign: 'center' }}
      />
      {codeStatus === 'wrong' ? <p role="alert" style={{ color: '#f2a07a', textAlign: 'left', margin: 0 }}>That code isn&rsquo;t right. Check the newest email.</p> : null}
      {codeStatus === 'too_many' ? (
        <p role="alert" style={{ color: '#f2a07a', textAlign: 'left', margin: 0 }}>
          Too many tries. Ask for a new link, or <a href="sms:+18595121419" style={{ textDecoration: 'underline' }}>text Sam</a>.
        </p>
      ) : null}
      {codeStatus === 'error' ? <p role="alert" style={{ color: '#f2a07a', textAlign: 'left', margin: 0 }}>That didn&rsquo;t go through. Please try again.</p> : null}
      <button type="submit" className="cs-btn light" disabled={codeStatus === 'checking' || code.replace(/\D/g, '').length !== 6}>
        {codeStatus === 'checking' ? 'Checking…' : 'Sign in with the code'}
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
            <p>We sent {email} a link and a code. Tap the link on this device, or type the code here. Both work once, for 15 minutes.</p>
            {codeForm}
            <p className="cs-login-foot">
              Nothing arrived? Check spam, or{' '}
              <button onClick={() => setStatus('idle')} style={linkStyle}>
                try again
              </button>
              .
            </p>
            {troubleBlock}
          </>
        ) : codeMode ? (
          <>
            <h1>Type your code.</h1>
            {note ? <p style={{ color: '#f7f6f3' }}>{note}</p> : null}
            {codeForm}
            <p className="cs-login-foot">
              No code?{' '}
              <button onClick={() => { setCodeMode(false); setNote('') }} style={linkStyle}>
                Ask for a new link
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
            <p className="cs-login-foot">
              Have a code?{' '}
              <button onClick={() => setCodeMode(true)} style={linkStyle}>
                Type it
              </button>
              . No password needed. New to Oliver Street? <a href="sms:+18595121419" style={{ textDecoration: 'underline' }}>Text Sam</a>.
            </p>
            {troubleBlock}
          </>
        )}
      </div>
    </div>
  )
}
