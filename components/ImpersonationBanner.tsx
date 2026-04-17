import { getImpersonationState } from '@/lib/auth/impersonation'

export async function ImpersonationBanner() {
  const state = await getImpersonationState()
  if (!state) return null

  const roleLabel =
    state.targetRole === 'CLIENT'
      ? 'Client'
      : state.targetRole === 'CREW'
      ? 'Crew'
      : state.targetRole ?? 'Unknown'

  return (
    <>
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 100,
          height: '36px',
          background: '#f59e0b',
          color: '#78350f',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '16px',
          padding: '0 24px',
          fontSize: '13px',
          fontWeight: 600,
          fontFamily: 'var(--font-body, Inter, sans-serif)',
          letterSpacing: '0.02em',
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
        }}
      >
        <span>
          Impersonating:{' '}
          <strong style={{ fontWeight: 700 }}>
            {state.targetName ?? 'Unknown'}
          </strong>{' '}
          ({roleLabel}) — Read-only mode
        </span>
        <form action="/api/admin/impersonate/stop" method="POST">
          <button
            type="submit"
            style={{
              background: '#78350f',
              color: '#fef3c7',
              border: 'none',
              borderRadius: '4px',
              padding: '4px 14px',
              fontSize: '12px',
              fontWeight: 700,
              letterSpacing: '0.04em',
              cursor: 'pointer',
              fontFamily: 'var(--font-body, Inter, sans-serif)',
            }}
          >
            Stop Impersonating
          </button>
        </form>
      </div>
      {/* Spacer to push content below the fixed banner */}
      <div style={{ height: '36px', flexShrink: 0 }} />
    </>
  )
}
