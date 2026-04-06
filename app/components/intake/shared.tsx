"use client"

import { useState, type ReactNode } from "react"

export function IntakeLayout({
  children,
  title,
  subtitle,
}: {
  children: ReactNode
  title: string
  subtitle: string
}) {
  return (
    <div className="intake-page">
      <nav className="nav-bar">
        <a href="/" style={{ textDecoration: "none" }}>
          <span
            style={{
              fontWeight: 900,
              fontSize: 18,
              letterSpacing: "-0.02em",
              color: "var(--paper)",
            }}
          >
            OLIVER STREET CREATIVE
          </span>
        </a>
        <div className="nav-links">
          <a href="/join-our-crew" className="intake-nav-link">
            Crew
          </a>
          <a href="/casting" className="intake-nav-link">
            Casting
          </a>
          <a href="/locations" className="intake-nav-link">
            Locations
          </a>
        </div>
      </nav>

      <div className="intake-container">
        <div className="intake-header">
          <h1>{title}</h1>
          <p className="font-accent">{subtitle}</p>
        </div>
        {children}
      </div>

      <footer className="footer-bar">
        <span>&copy; {new Date().getFullYear()} Oliver Street Creative</span>
        <span>Covington, KY &middot; Serving Cincinnati &amp; Northern Kentucky</span>
      </footer>
    </div>
  )
}

export function FieldGroup({
  label,
  error,
  required,
  children,
}: {
  label: string
  error?: string
  required?: boolean
  children: ReactNode
}) {
  return (
    <div className="intake-field">
      <label>
        <span className="intake-label-text">
          {label}
          {required && <span className="intake-required">*</span>}
        </span>
        {children}
      </label>
      {error && <span className="intake-error" role="alert">{error}</span>}
    </div>
  )
}

export function CheckboxGroup({
  label,
  options,
  selected,
  onChange,
  error,
  required,
}: {
  label: string
  options: string[]
  selected: string[]
  onChange: (val: string[]) => void
  error?: string
  required?: boolean
}) {
  const toggle = (opt: string) => {
    if (selected.includes(opt)) {
      onChange(selected.filter((s) => s !== opt))
    } else {
      onChange([...selected, opt])
    }
  }

  return (
    <fieldset className="intake-field" style={{ border: "none", padding: 0, margin: 0 }}>
      <legend className="intake-label-text">
        {label}
        {required && <span className="intake-required">*</span>}
      </legend>
      <div className="intake-checkbox-group" role="group" aria-label={label}>
        {options.map((opt) => (
          <label key={opt} className="intake-checkbox-label">
            <input
              type="checkbox"
              checked={selected.includes(opt)}
              onChange={() => toggle(opt)}
            />
            <span>{opt}</span>
          </label>
        ))}
      </div>
      {error && <span className="intake-error" role="alert">{error}</span>}
    </fieldset>
  )
}

export function SuccessMessage({ formType }: { formType: string }) {
  const messages: Record<string, { title: string; body: string }> = {
    crew: {
      title: "Application Received",
      body: "Thanks for your interest in working with Oliver Street Creative. We review submissions regularly and will be in touch if there's a fit.",
    },
    casting: {
      title: "Submission Received",
      body: "Thanks for adding yourself to our talent database. We'll reach out when we have a role that matches your profile.",
    },
    locations: {
      title: "Location Submitted",
      body: "Thanks for sharing your space with us. We'll keep it in our database and reach out if it's a fit for an upcoming production.",
    },
  }

  const msg = messages[formType] || messages.crew

  return (
    <div className="intake-success">
      <div className="intake-success-icon">&#10003;</div>
      <h2>{msg.title}</h2>
      <p>{msg.body}</p>
      <a href="/" className="intake-btn">
        Back to Oliver Street Creative
      </a>
    </div>
  )
}

export function useIntakeSubmit(formType: string) {
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [serverError, setServerError] = useState("")

  const submit = async (data: Record<string, unknown>, honeypot: string) => {
    setSubmitting(true)
    setServerError("")
    try {
      const res = await fetch("/api/intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: formType, data, _hp: honeypot }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || "Submission failed")
      }
      setSuccess(true)
    } catch (err) {
      setServerError(
        err instanceof Error ? err.message : "Something went wrong"
      )
    } finally {
      setSubmitting(false)
    }
  }

  return { submitting, success, serverError, submit }
}
