'use client'

import { useState } from 'react'

type Props = {
  taskId: string
  projectId: string
  initialChecked: boolean
}

export function TaskCheckbox({ taskId, projectId, initialChecked }: Props) {
  const [checked, setChecked] = useState(initialChecked)
  const [showNote, setShowNote] = useState(false)
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleCheck(newChecked: boolean) {
    if (newChecked) {
      // Show note input before submitting
      setShowNote(true)
    } else {
      // Uncheck immediately
      await submitEvent(false, '')
    }
  }

  async function submitEvent(isChecked: boolean, noteText: string) {
    setLoading(true)
    try {
      await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_type: isChecked ? 'task_checked' : 'task_unchecked',
          project_id: projectId,
          payload: {
            task_id: taskId,
            note: noteText || undefined,
          },
        }),
      })
      setChecked(isChecked)
      setShowNote(false)
      setNote('')
    } catch {
      // Silently fail — state reverts on refresh
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <input
        type="checkbox"
        checked={checked}
        disabled={loading}
        onChange={(e) => handleCheck(e.target.checked)}
        style={{
          width: '16px',
          height: '16px',
          cursor: loading ? 'not-allowed' : 'pointer',
          accentColor: 'var(--green)',
        }}
      />
      {showNote && (
        <div
          style={{
            marginTop: '8px',
            display: 'flex',
            gap: '8px',
            alignItems: 'center',
          }}
        >
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Optional note..."
            autoFocus
            style={{
              flex: 1,
              padding: '6px 10px',
              background: 'rgba(247,246,243,0.06)',
              border: '1px solid rgba(138,138,132,0.25)',
              borderRadius: '6px',
              color: 'var(--paper)',
              fontSize: '13px',
              outline: 'none',
            }}
          />
          <button
            onClick={() => submitEvent(true, note)}
            disabled={loading}
            style={{
              padding: '6px 14px',
              background: 'var(--green)',
              color: '#fff',
              fontSize: '12px',
              fontWeight: 700,
              borderRadius: '6px',
              border: 'none',
              cursor: loading ? 'not-allowed' : 'pointer',
            }}
          >
            Done
          </button>
          <button
            onClick={() => setShowNote(false)}
            style={{
              padding: '6px 10px',
              background: 'transparent',
              color: 'var(--quiet)',
              fontSize: '12px',
              borderRadius: '6px',
              border: '1px solid rgba(138,138,132,0.2)',
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  )
}
