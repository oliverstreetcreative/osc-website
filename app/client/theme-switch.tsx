"use client"
// Appearance switch for the account menu (SPEC §20 v2): Auto · Light · Dark. It only sets a device cookie and the
// root's data-theme attribute; nothing is sent to the server, so it works for staff viewing a client and the demo.
import { useState } from "react"

type Theme = "auto" | "light" | "dark"
const LABELS: [Theme, string][] = [["auto", "Auto"], ["light", "Light"], ["dark", "Dark"]]

function setCookie(theme: Theme) {
  const host = window.location.hostname
  // On our own domain the choice is shared with the hub and Review; elsewhere (staging) it stays on this host.
  const domain = host === "oliverstreetcreative.com" || host.endsWith(".oliverstreetcreative.com") ? "; domain=.oliverstreetcreative.com" : ""
  const secure = window.location.protocol === "https:" ? "; secure" : ""
  document.cookie =
    theme === "auto"
      ? `cs_theme=; path=/; max-age=0; samesite=lax${domain}${secure}`
      : `cs_theme=${theme}; path=/; max-age=31536000; samesite=lax${domain}${secure}`
}

export function ThemeSwitch({ initial }: { initial: Theme }) {
  const [theme, setTheme] = useState<Theme>(initial)
  return (
    <div className="cs-theme" role="group" aria-label="Appearance">
      {LABELS.map(([value, label]) => (
        <button
          key={value}
          type="button"
          aria-pressed={theme === value}
          onClick={() => {
            setCookie(value)
            document.querySelectorAll(".cs[data-theme]").forEach((el) => el.setAttribute("data-theme", value))
            setTheme(value)
          }}
        >
          {label}
        </button>
      ))}
    </div>
  )
}
