'use client'

import { useState } from 'react'

type Props = {
  table: string
  rowId: string
  field: 'client_visible' | 'crew_visible'
  initialValue: boolean
}

export function VisibilityToggle({ table, rowId, field, initialValue }: Props) {
  const [value, setValue] = useState(initialValue)
  const [pending, setPending] = useState(false)

  async function handleChange(next: boolean) {
    setValue(next)
    setPending(true)
    try {
      const res = await fetch('/api/admin/visibility', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ table, row_id: rowId, field, value: next }),
      })
      if (!res.ok) throw new Error('Request failed')
    } catch {
      setValue(!next)
    } finally {
      setPending(false)
    }
  }

  return (
    <input
      type="checkbox"
      checked={value}
      disabled={pending}
      onChange={(e) => handleChange(e.target.checked)}
      style={{
        width: '16px',
        height: '16px',
        cursor: pending ? 'wait' : 'pointer',
        accentColor: '#e05c5c',
        opacity: pending ? 0.5 : 1,
      }}
    />
  )
}
