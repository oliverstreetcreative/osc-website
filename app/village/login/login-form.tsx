"use client"

import { FormEvent, useState } from "react"

export function VillageLoginForm() {
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      const res = await fetch("/api/unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      })
      if (res.ok) {
        window.location.replace("/")
        return
      }
      setError("Wrong password.")
    } catch {
      setError("Network error. Try again.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <main
      style={{
        position: "fixed",
        inset: 0,
        background: "black",
        color: "white",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "var(--font-inter), system-ui, sans-serif",
        padding: "24px",
      }}
    >
      <form
        onSubmit={handleSubmit}
        style={{
          width: "100%",
          maxWidth: "360px",
          display: "flex",
          flexDirection: "column",
          gap: "16px",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <h1 style={{ fontSize: "24px", fontWeight: 600, margin: 0 }}>
            Video Village
          </h1>
          <p style={{ margin: "8px 0 0", opacity: 0.6, fontSize: "14px" }}>
            Enter password to watch.
          </p>
        </div>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoFocus
          autoComplete="current-password"
          placeholder="Password"
          disabled={busy}
          style={{
            padding: "14px 16px",
            fontSize: "16px",
            background: "#111",
            color: "white",
            border: "1px solid #333",
            borderRadius: "8px",
            outline: "none",
          }}
        />
        <button
          type="submit"
          disabled={busy || password.length === 0}
          style={{
            padding: "14px 16px",
            fontSize: "16px",
            fontWeight: 600,
            background: "white",
            color: "black",
            border: "none",
            borderRadius: "8px",
            cursor: busy ? "not-allowed" : "pointer",
            opacity: busy || password.length === 0 ? 0.6 : 1,
          }}
        >
          {busy ? "Checking…" : "Watch"}
        </button>
        {error ? (
          <p style={{ margin: 0, color: "#ff6b6b", fontSize: "14px", textAlign: "center" }}>
            {error}
          </p>
        ) : null}
      </form>
    </main>
  )
}
