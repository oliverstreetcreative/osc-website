'use client'

import { useState, useEffect } from 'react'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'sent' | 'error'>('idle')
  const [note, setNote] = useState('')
  useEffect(() => {
    const q = new URLSearchParams(window.location.search)
    if (q.get('no_account')) setNote('You’re signed in, but no client account is linked to this email yet. Text Sam and he’ll set it up.')
    else if (q.get('signed_out')) setNote('You’re signed out.')
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
          </>
        )}
      </div>
    </div>
  )
}
