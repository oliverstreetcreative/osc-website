'use client'

import { useState } from 'react'

type Props = {
  inviteId: string
  status: 'Accepted' | 'Expired' | 'Pending'
}

export function InviteActions({ inviteId, status }: Props) {
  const [busy, setBusy] = useState<'resend' | 'revoke' | null>(null)
  const [done, setDone] = useState<string | null>(null)

  async function act(action: 'resend' | 'revoke') {
    setBusy(action)
    try {
      const res = await fetch(`/api/admin/invites/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invite_id: inviteId }),
      })
      if (!res.ok) throw new Error('Failed')
      setDone(action === 'resend' ? 'Sent' : 'Revoked')
    } catch {
      setDone('Error')
    } finally {
      setBusy(null)
    }
  }

  if (done) {
    return (
      <span
        style={{
          fontSize: '11px',
          color: done === 'Error' ? '#e05c5c' : 'var(--quiet)',
        }}
      >
        {done}
      </span>
    )
  }

  const btnStyle = {
    background: 'transparent',
    border: '1px solid rgba(138,138,132,0.3)',
    color: 'var(--quiet)',
    padding: '3px 10px',
    borderRadius: '4px',
    fontSize: '11px',
    fontWeight: 600,
    cursor: 'pointer',
    letterSpacing: '0.03em',
  }

  return (
    <div style={{ display: 'flex', gap: '6px' }}>
      {status !== 'Accepted' && (
        <button
          onClick={() => act('resend')}
          disabled={!!busy}
          style={btnStyle}
        >
          {busy === 'resend' ? '…' : 'Resend'}
        </button>
      )}
      {status !== 'Accepted' && (
        <button
          onClick={() => act('revoke')}
          disabled={!!busy}
          style={{
            ...btnStyle,
            borderColor: 'rgba(224,92,92,0.35)',
            color: '#e05c5c',
          }}
        >
          {busy === 'revoke' ? '…' : 'Revoke'}
        </button>
      )}
    </div>
  )
}
