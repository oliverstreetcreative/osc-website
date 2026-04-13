"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { castingSchema, type CastingFormData } from "@/lib/intake-schemas"
import { useState } from "react"
import {
  FieldGroup,
  CheckboxGroup,
  SuccessMessage,
  useIntakeSubmit,
} from "./shared"

const ROLE_OPTIONS = [
  "Lead roles",
  "Supporting",
  "Background",
  "Commercial",
  "All of the above",
] as const

const REFERRAL_OPTIONS = [
  "Social Media",
  "Google Search",
  "Word of Mouth",
  "Casting Call",
  "Film Community",
  "Other",
]

export default function CastingForm() {
  const [honeypot, setHoneypot] = useState("")
  const { submitting, success, serverError, submit } = useIntakeSubmit("casting")

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<CastingFormData>({
    resolver: zodResolver(castingSchema),
    defaultValues: {
      roleWillingness: [],
      headshotUrl: "",
      reelLink: "",
    },
  })

  const roleWillingness = watch("roleWillingness")

  if (success) return <SuccessMessage formType="casting" />

  const onSubmit = (data: CastingFormData) => {
    submit(data as unknown as Record<string, unknown>, honeypot)
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="intake-form">
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
      </div>

      <div className="intake-section">
        <h3>Physical Details</h3>
        <div className="intake-grid-3">
          <FieldGroup label="Height">
            <input {...register("height")} placeholder="5'10&quot;" />
          </FieldGroup>
          <FieldGroup label="Build">
            <input {...register("build")} placeholder="Athletic, slim, etc." />
          </FieldGroup>
          <FieldGroup label="Age range you play">
            <input {...register("ageRange")} placeholder="25-35" />
          </FieldGroup>
        </div>
      </div>

      <div className="intake-section">
        <h3>Experience</h3>
        <div className="intake-grid-2">
          <FieldGroup label="Experience Level" error={errors.experienceLevel?.message} required>
            <select {...register("experienceLevel")} defaultValue="">
              <option value="" disabled>Select level</option>
              {["No Experience", "Some", "Trained", "Professional"].map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </FieldGroup>
          <FieldGroup label="Union Status" error={errors.unionStatus?.message} required>
            <select {...register("unionStatus")} defaultValue="">
              <option value="" disabled>Select status</option>
              {["Non-union", "SAG-eligible", "SAG-AFTRA"].map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </FieldGroup>
        </div>
        <FieldGroup label="Special skills (languages, sports, instruments, stunts, etc.)">
          <textarea {...register("specialSkills")} rows={3} placeholder="List any special skills" />
        </FieldGroup>
        <CheckboxGroup
          label="Willing to do"
          options={[...ROLE_OPTIONS]}
          selected={roleWillingness || []}
          onChange={(val) => setValue("roleWillingness", val as CastingFormData["roleWillingness"], { shouldValidate: true })}
          error={errors.roleWillingness?.message}
          required
        />
        <FieldGroup label="Representation (agent/manager, or self-represented)">
          <input {...register("representation")} placeholder="Self-represented" />
        </FieldGroup>
      </div>

      <div className="intake-section">
        <h3>Media &amp; Links</h3>
        <FieldGroup label="Headshot URL" error={errors.headshotUrl?.message}>
          <input {...register("headshotUrl")} type="url" placeholder="https://... (link to your headshot)" />
        </FieldGroup>
        <FieldGroup label="Acting reel or portfolio link" error={errors.reelLink?.message}>
          <input {...register("reelLink")} type="url" placeholder="https://..." />
        </FieldGroup>
      </div>

      <div className="intake-section">
        <h3>Final Details</h3>
        <FieldGroup label="How did you hear about us?" error={errors.referralSource?.message} required>
          <select {...register("referralSource")} defaultValue="">
            <option value="" disabled>Select one</option>
            {REFERRAL_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        </FieldGroup>
      </div>

      {serverError && <div className="intake-server-error">{serverError}</div>}

      <button type="submit" className="intake-btn" disabled={submitting}>
        {submitting ? "Submitting..." : "Submit to Talent Database"}
      </button>
    </form>
  )
}
