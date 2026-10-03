"use client"

export function PrintButton() {
  return (
    <button type="button" className="cs-btn sm" onClick={() => window.print()}>
      Print or save as PDF
    </button>
  )
}
