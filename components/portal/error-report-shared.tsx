/**
 * Shared primitives for error-report list pages.
 *
 * Used by both app/client/issues/page.tsx and app/crew/issues/page.tsx to avoid
 * duplicating the colour-mapping helpers and Badge wrapper.
 */

import { Badge } from '@/components/ui/badge'
import type { CSSProperties } from 'react'

// ---------------------------------------------------------------------------
// Colour helpers
// ---------------------------------------------------------------------------

export function statusStyle(status: string): CSSProperties {
  switch (status) {
    case 'resolved':
      return { color: 'var(--green)', borderColor: 'rgba(58,138,92,0.4)' }
    case 'triaged':
      return { color: 'var(--gold)', borderColor: 'rgba(242,193,78,0.4)' }
    case 'open':
    default:
      return { color: 'var(--quiet)', borderColor: 'rgba(138,138,132,0.3)' }
  }
}

export function severityStyle(severity: string): CSSProperties {
  switch (severity) {
    case 'blocking':
      return { color: 'var(--red)', borderColor: 'rgba(220,53,69,0.4)' }
    case 'moderate':
    default:
      return { color: 'var(--quiet)', borderColor: 'rgba(138,138,132,0.3)' }
    case 'minor':
      return { color: 'var(--quiet)', borderColor: 'rgba(138,138,132,0.2)' }
  }
}

// ---------------------------------------------------------------------------
// Badge components
// ---------------------------------------------------------------------------

export function StatusBadge({ status }: { status: string }) {
  return (
    <Badge
      variant="outline"
      style={{ fontSize: '10px', textTransform: 'capitalize', ...statusStyle(status) }}
    >
      {status}
    </Badge>
  )
}

export function SeverityBadge({ severity }: { severity: string }) {
  return (
    <Badge
      variant="outline"
      style={{ fontSize: '10px', textTransform: 'capitalize', ...severityStyle(severity) }}
    >
      {severity}
    </Badge>
  )
}
