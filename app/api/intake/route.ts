import { NextRequest, NextResponse } from "next/server"
import { crewSchema, castingSchema, locationSchema } from "@/lib/intake-schemas"
import { createBaserowRow, INTAKE_TABLES, type IntakeType } from "@/lib/baserow"
import type { CrewFormData, CastingFormData, LocationFormData } from "@/lib/intake-schemas"

// Simple in-memory rate limiter: 5 submissions per IP per hour
const rateLimitMap = new Map<string, number[]>()
const RATE_LIMIT = 5
const RATE_WINDOW = 60 * 60 * 1000 // 1 hour

function checkRateLimit(ip: string): boolean {
  const now = Date.now()
  const timestamps = rateLimitMap.get(ip) || []
  const recent = timestamps.filter((t) => now - t < RATE_WINDOW)
  if (recent.length >= RATE_LIMIT) return false
  recent.push(now)
  rateLimitMap.set(ip, recent)
  return true
}

const schemas = {
  crew: crewSchema,
  casting: castingSchema,
  locations: locationSchema,
} as const

function mapCrewToBaserow(data: CrewFormData, ip: string) {
  return {
    Name: data.name,
    Email: data.email,
    Phone: data.phone,
    City_State: data.cityState,
    "Cincinnati Area": data.cincinnatiArea,
    Departments: [
      ...data.departments,
      ...(data.departmentsOther ? [`Other: ${data.departmentsOther}`] : []),
    ].join(", "),
    "Camera Experience": data.cameraExperience || "",
    "DaVinci Resolve": data.davinciResolve,
    Bio: data.bio,
    "Willing PA": data.willingPA,
    "Compensation Tier": data.compensationTier,
    "Portfolio Link": data.portfolioLink || "",
    "Referral Source": data.referralSource,
    "Extra Notes": data.extraNotes || "",
    Status: "Pending",
    "Submitted At": new Date().toISOString(),
    "Submitted From IP": ip,
  }
}

function mapCastingToBaserow(data: CastingFormData, ip: string) {
  return {
    Name: data.name,
    Email: data.email,
    Phone: data.phone,
    City_State: data.cityState,
    "Headshot URL": data.headshotUrl || "",
    Height: data.height || "",
    Build: data.build || "",
    "Age Range": data.ageRange || "",
    "Experience Level": data.experienceLevel,
    "Union Status": data.unionStatus,
    "Reel Link": data.reelLink || "",
    "Special Skills": data.specialSkills || "",
    "Role Willingness": data.roleWillingness.join(", "),
    Representation: data.representation || "",
    "Referral Source": data.referralSource,
    Status: "Pending",
    "Submitted At": new Date().toISOString(),
    "Submitted From IP": ip,
  }
}

function mapLocationToBaserow(data: LocationFormData, ip: string) {
  return {
    Name: data.name,
    Email: data.email,
    Phone: data.phone,
    Address: data.address,
    Area: data.area || "",
    "Location Type": data.locationType,
    Description: data.description,
    "Photo URLs": data.photoUrls || "",
    Availability: data.availability,
    Restrictions: data.restrictions || "",
    Compensation: data.compensation,
    "Referral Source": data.referralSource,
    Status: "Pending",
    "Submitted At": new Date().toISOString(),
    "Submitted From IP": ip,
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { type, data, _hp } = body as {
      type: IntakeType
      data: Record<string, unknown>
      _hp?: string
    }

    // Honeypot check — if filled, silently succeed (bots think it worked)
    if (_hp) {
      return NextResponse.json({ success: true })
    }

    // Validate type
    if (!type || !schemas[type]) {
      return NextResponse.json(
        { error: "Invalid form type" },
        { status: 400 }
      )
    }

    // Rate limit
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "unknown"
    if (!checkRateLimit(ip)) {
      return NextResponse.json(
        { error: "Too many submissions. Please try again later." },
        { status: 429 }
      )
    }

    // Validate
    const schema = schemas[type]
    const parsed = schema.safeParse(data)
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    // Map to Baserow fields
    let baserowData: Record<string, unknown>
    switch (type) {
      case "crew":
        baserowData = mapCrewToBaserow(parsed.data as CrewFormData, ip)
        break
      case "casting":
        baserowData = mapCastingToBaserow(parsed.data as CastingFormData, ip)
        break
      case "locations":
        baserowData = mapLocationToBaserow(parsed.data as LocationFormData, ip)
        break
    }

    const row = await createBaserowRow(INTAKE_TABLES[type], baserowData)

    return NextResponse.json({ success: true, id: row.id })
  } catch (err) {
    console.error("Intake submission error:", err)
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    )
  }
}
