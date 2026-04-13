"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { crewSchema, type CrewFormData } from "@/lib/intake-schemas"
import { useState } from "react"
import {
  FieldGroup,
  CheckboxGroup,
  SuccessMessage,
  useIntakeSubmit,
} from "./shared"

const DEPARTMENTS = [
  "Camera / Second Shooter",
  "Gaffer / Grip / Swing",
  "Production Design / Art Dept",
  "Editing",
  "Graphics / Animation / DaVinci Resolve Fusion",
  "Sound",
  "Production Assistant / General Crew",
  "Producer / Coordinator",
  "Other",
] as const

const REFERRAL_OPTIONS = [
  "Social Media",
  "Google Search",
  "Word of Mouth",
  "Film Community",
  "Job Board",
  "Other",
]

export default function CrewForm() {
  const [honeypot, setHoneypot] = useState("")
  const { submitting, success, serverError, submit } = useIntakeSubmit("crew")

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<CrewFormData>({
    resolver: zodResolver(crewSchema),
    defaultValues: {
      departments: [],
      willingPA: false,
      portfolioLink: "",
      extraNotes: "",
      departmentsOther: "",
    },
  })

  const departments = watch("departments")
  const showOther = departments?.includes("Other")

  if (success) return <SuccessMessage formType="crew" />

  const onSubmit = (data: CrewFormData) => {
    submit(data as unknown as Record<string, unknown>, honeypot)
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="intake-form">
      {/* Honeypot — hidden from real users */}
      <div style={{ position: "absolute", left: "-9999px" }} aria-hidden="true">
        <input
          type="text"
          name="website"
          tabIndex={-1}
          autoComplete="off"
          value={honeypot}
          onChange={(e) => setHoneypot(e.target.value)}
        />
      </div>

      <div className="intake-section">
        <h3>Contact Info</h3>
        <div className="intake-grid-2">
          <FieldGroup label="Full Name" error={errors.name?.message} required>
            <input {...register("name")} placeholder="Your full name" />
          </FieldGroup>
          <FieldGroup label="Email" error={errors.email?.message} required>
            <input {...register("email")} type="email" placeholder="you@email.com" />
          </FieldGroup>
        </div>
        <div className="intake-grid-2">
          <FieldGroup label="Phone" error={errors.phone?.message} required>
            <input {...register("phone")} type="tel" placeholder="(555) 555-5555" />
          </FieldGroup>
          <FieldGroup label="City / State" error={errors.cityState?.message} required>
            <input {...register("cityState")} placeholder="Cincinnati, OH" />
          </FieldGroup>
        </div>
        <FieldGroup
          label="Are you in the Greater Cincinnati area, or willing to travel here?"
          error={errors.cincinnatiArea?.message}
          required
        >
          <div className="intake-radio-group">
            {["Yes", "No", "Remote Only"].map((opt) => (
              <label key={opt} className="intake-radio-label">
                <input type="radio" value={opt} {...register("cincinnatiArea")} />
                <span>{opt}</span>
              </label>
            ))}
          </div>
        </FieldGroup>
      </div>

      <div className="intake-section">
        <h3>Skills &amp; Experience</h3>
        <CheckboxGroup
          label="What departments/roles interest you?"
          options={[...DEPARTMENTS]}
          selected={departments || []}
          onChange={(val) => setValue("departments", val as CrewFormData["departments"], { shouldValidate: true })}
          error={errors.departments?.message}
          required
        />
        {showOther && (
          <FieldGroup label="Other (please specify)">
            <input {...register("departmentsOther")} placeholder="Describe your role interest" />
          </FieldGroup>
        )}
        <FieldGroup label="Most advanced camera you've operated?" error={errors.cameraExperience?.message}>
          <input {...register("cameraExperience")} placeholder="e.g., RED Komodo, Sony FX6, Canon C70" />
        </FieldGroup>
        <FieldGroup label="DaVinci Resolve experience" error={errors.davinciResolve?.message} required>
          <select {...register("davinciResolve")} defaultValue="">
            <option value="" disabled>
              Select your level
            </option>
            {["No", "Learning", "Proficient", "Expert"].map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </FieldGroup>
      </div>

      <div className="intake-section">
        <h3>About You</h3>
        <FieldGroup label="Tell us about yourself and your experience" error={errors.bio?.message} required>
          <textarea
            {...register("bio")}
            rows={5}
            placeholder="What drives you? What kind of work excites you? What's your experience level?"
          />
        </FieldGroup>
        <div className="intake-checkbox-standalone">
          <label className="intake-checkbox-label intake-checkbox-highlight">
            <input type="checkbox" {...register("willingPA")} />
            <span>
              I&apos;m willing to do whatever is needed on set, including PA work
            </span>
          </label>
        </div>
        <FieldGroup label="Compensation expectations" error={errors.compensationTier?.message} required>
          <select {...register("compensationTier")} defaultValue="">
            <option value="" disabled>
              Select tier
            </option>
            {["$ (Learning/Low)", "$$ (Market Rate)", "$$$ (Senior/Premium)"].map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </FieldGroup>
        <FieldGroup label="Link to your best work or portfolio" error={errors.portfolioLink?.message}>
          <input {...register("portfolioLink")} type="url" placeholder="https://..." />
        </FieldGroup>
      </div>

      <div className="intake-section">
        <h3>Final Details</h3>
        <FieldGroup label="How did you hear about us?" error={errors.referralSource?.message} required>
          <select {...register("referralSource")} defaultValue="">
            <option value="" disabled>
              Select one
            </option>
            {REFERRAL_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </FieldGroup>
        <FieldGroup label="Anything else we should know?">
          <textarea {...register("extraNotes")} rows={3} placeholder="Optional" />
        </FieldGroup>
      </div>

      {serverError && <div className="intake-server-error">{serverError}</div>}

      <button type="submit" className="intake-btn" disabled={submitting}>
        {submitting ? "Submitting..." : "Submit Application"}
      </button>
    </form>
  )
}
