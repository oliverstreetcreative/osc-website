"use client"
// Appearance switch for the account menu (SPEC §20 v2, the hub's conventions): Auto · Light · Dark. It only stores the
// choice on this device (localStorage `osc.portal.look`) and sets <html data-look>; nothing is sent to the server, so
// it works for staff viewing a client and in the demo.
import { useEffect, useState } from "react"
import { applyLook, readLook, storeLook, type Look } from "@/lib/client/theme"

const LABELS: [Look, string][] = [["auto", "Auto"], ["light", "Light"], ["dark", "Dark"]]

export function ThemeSwitch() {
  const [look, setLook] = useState<Look>("auto")
  useEffect(() => setLook(readLook()), [])
  return (
    <div className="cs-theme" role="group" aria-label="Appearance">
      {LABELS.map(([value, label]) => (
        <button
          key={value}
          type="button"
          aria-pressed={look === value}
          onClick={() => {
            storeLook(value)
            applyLook(value)
            setLook(value)
          }}
        >
          {label}
        </button>
      ))}
    </div>
  )
}
