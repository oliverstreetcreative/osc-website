'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'sent' | 'error'>('idle')

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
    <div className="min-h-screen flex items-center justify-center bg-[var(--ink)] px-4">
      <div className="w-full max-w-sm space-y-8">
        <div className="space-y-2 text-center">
          <h1
            className="text-4xl text-[var(--paper)]"
            style={{ fontFamily: 'var(--font-garamond)', fontStyle: 'italic' }}
          >
            Oliver Street Creative
          </h1>
          <p className="text-[var(--quiet)] text-sm">Portal access</p>
        </div>

        {status === 'sent' ? (
          <div className="text-center space-y-2">
            <p className="text-[var(--paper)]">Check your email.</p>
            <p className="text-[var(--quiet)] text-sm">We sent a login link to {email}.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-[var(--paper)] text-sm">
                Email address
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={status === 'loading'}
                className="bg-transparent border-[var(--mid)] text-[var(--paper)] placeholder:text-[var(--quiet)] focus-visible:border-[var(--paper)] focus-visible:ring-0"
              />
            </div>

            {status === 'error' && (
              <p className="text-sm text-red-400">Something went wrong. Please try again.</p>
            )}

            <Button
              type="submit"
              disabled={status === 'loading'}
              className="w-full bg-[var(--paper)] text-[var(--ink)] hover:bg-[var(--faint)]"
            >
              {status === 'loading' ? 'Sending…' : 'Send me a login link'}
            </Button>
          </form>
        )}
      </div>
    </div>
  )
}
