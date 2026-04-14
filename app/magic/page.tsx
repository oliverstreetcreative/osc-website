'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

function MagicVerify() {
  const router = useRouter()
  const params = useSearchParams()
  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying')
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    const token = params.get('token')
    if (!token) {
      setErrorMsg('No token provided.')
      setStatus('error')
      return
    }

    fetch('/api/auth/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    })
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          throw new Error(body.error ?? 'Verification failed')
        }
        return res.json()
      })
      .then(({ redirectTo }) => {
        setStatus('success')
        router.replace(redirectTo ?? '/')
      })
      .catch((err) => {
        setErrorMsg(err.message)
        setStatus('error')
      })
  }, [params, router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--ink)] px-4">
      <div className="text-center space-y-3">
        {status === 'verifying' && (
          <>
            <p className="text-[var(--paper)]">Verifying your link…</p>
          </>
        )}
        {status === 'success' && (
          <p className="text-[var(--paper)]">Signed in. Redirecting…</p>
        )}
        {status === 'error' && (
          <>
            <p className="text-[var(--paper)]">This link is invalid or has expired.</p>
            {errorMsg && <p className="text-[var(--quiet)] text-sm">{errorMsg}</p>}
            <a href="/login" className="text-sm text-[var(--paper)] underline underline-offset-4">
              Request a new link
            </a>
          </>
        )}
      </div>
    </div>
  )
}

export default function MagicPage() {
  return (
    <Suspense>
      <MagicVerify />
    </Suspense>
  )
}
