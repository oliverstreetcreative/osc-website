'use client'

import { Button } from '@/components/ui/button'

export function SignOutButton() {
  async function handleSignOut() {
    await fetch('/api/auth/logout', { method: 'POST' })
    window.location.href = '/'
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleSignOut}
      style={{
        background: 'transparent',
        borderColor: 'rgba(255,255,255,0.3)',
        color: 'var(--paper)',
        fontSize: '12px',
      }}
    >
      Sign Out
    </Button>
  )
}
