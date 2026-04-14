"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { locationSchema, type LocationFormData } from "@/lib/intake-schemas"
import { useState } from "react"
import { FieldGroup, SuccessMessage, useIntakeSubmit } from "./shared"

const LOCATION_TYPES = [
  "Home",
  "Business",
  "Outdoor",
  "Industrial",
  "Historic",
  "Church",
  "Restaurant",
  "Other",
] as const

const REFERRAL_OPTIONS = [
  "Social Media",
  "Google Search",
  "Word of Mouth",
  "Film Community",
  "Real Estate",
  "Other",
]

export default function LocationForm() {
  const [honeypot, setHoneypot] = useState("")
  const { submitting, success, serverError, submit } =
    useIntakeSubmit("locations")

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LocationFormData>({
    resolver: zodResolver(locationSchema),
    defaultValues: {
      photoUrls: "",
    },
  })

  if (success) return <SuccessMessage formType="locations" />

  const onSubmit = (data: LocationFormData) => {
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
        <h3>Your Contact Info</h3>
        <div className="intake-grid-2">
          <FieldGroup label="Your Name" error={errors.name?.message} required>
            <input {...register("name")} placeholder="Your full name" />
          </FieldGroup>
          <FieldGroup label="Email" error={errors.email?.message} required>
            <input
              {...register("email")}
              type="email"
              placeholder="you@email.com"
            />
          </FieldGroup>
        </div>
        <FieldGroup label="Phone" error={errors.phone?.message} required>
          <input
            {...register("phone")}
            type="tel"
            placeholder="(555) 555-5555"
          />
        </FieldGroup>
      </div>

      <div className="intake-section">
        <h3>Location Details</h3>
        <FieldGroup
          label="Address or general area"
          error={errors.address?.message}
          required
        >
          <input
            {...register("address")}
            placeholder="Street address or neighborhood/area"
          />
        </FieldGroup>
        <div className="intake-grid-2">
          <FieldGroup label="Neighborhood / Area">
            <input {...register("area")} placeholder="e.g., OTR, Covington, etc." />
          </FieldGroup>
          <FieldGroup
            label="Location Type"
            error={errors.locationType?.message}
            required
          >
            <select {...register("locationType")} defaultValue="">
              <option value="" disabled>
                Select type
              </option>
              {LOCATION_TYPES.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </FieldGroup>
        </div>
        <FieldGroup
          label="Description — what makes this place interesting for filming?"
          error={errors.description?.message}
          required
        >
          <textarea
            {...register("description")}
            rows={4}
            placeholder="Describe the space, its character, natural light, notable features..."
          />
        </FieldGroup>
        <FieldGroup label="Photo links (3-5 photos if possible)">
          <textarea
            {...register("photoUrls")}
            rows={3}
            placeholder="Paste links to photos, one per line. File uploads coming soon."
          />
        </FieldGroup>
      </div>

      <div className="intake-section">
        <h3>Availability &amp; Terms</h3>
        <div className="intake-grid-2">
          <FieldGroup
            label="Availability"
            error={errors.availability?.message}
            required
          >
            <select {...register("availability")} defaultValue="">
              <option value="" disabled>
                Select availability
              </option>
              {["Anytime", "Weekdays", "Weekends", "By Arrangement"].map(
                (opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                )
              )}
            </select>
          </FieldGroup>
          <FieldGroup
            label="Compensation"
            error={errors.compensation?.message}
            required
          >
            <select {...register("compensation")} defaultValue="">
              <option value="" disabled>
                Select preference
              </option>
              {["Free", "Trade", "Paid", "Negotiable"].map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </FieldGroup>
        </div>
        <FieldGroup label="Any restrictions? (noise, parking, hours, etc.)">
          <textarea
            {...register("restrictions")}
            rows={3}
            placeholder="Let us know about any constraints"
          />
        </FieldGroup>
      </div>

      <div className="intake-section">
        <h3>Final Details</h3>
        <FieldGroup
          label="How did you hear about us?"
          error={errors.referralSource?.message}
          required
        >
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
      </div>

      {serverError && <div className="intake-server-error">{serverError}</div>}

      <button type="submit" className="intake-btn" disabled={submitting}>
        {submitting ? "Submitting..." : "Submit Location"}
      </button>
    </form>
  )
}
