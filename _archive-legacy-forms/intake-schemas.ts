import { z } from "zod"

export const crewSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Valid email required"),
  phone: z.string().min(7, "Phone number required"),
  cityState: z.string().min(1, "Location is required"),
  cincinnatiArea: z.enum(["Yes", "No", "Remote Only"]),
  departments: z
    .array(
      z.enum([
        "Camera / Second Shooter",
        "Gaffer / Grip / Swing",
        "Production Design / Art Dept",
        "Editing",
        "Graphics / Animation / DaVinci Resolve Fusion",
        "Sound",
        "Production Assistant / General Crew",
        "Producer / Coordinator",
        "Other",
      ])
    )
    .min(1, "Select at least one department"),
  departmentsOther: z.string().optional(),
  cameraExperience: z.string().optional(),
  davinciResolve: z.enum(["No", "Learning", "Proficient", "Expert"]),
  bio: z.string().min(10, "Tell us a bit about yourself"),
  willingPA: z.boolean(),
  compensationTier: z.enum([
    "$ (Learning/Low)",
    "$$ (Market Rate)",
    "$$$ (Senior/Premium)",
  ]),
  portfolioLink: z.string().url("Enter a valid URL").or(z.literal("")),
  referralSource: z.string().min(1, "How did you hear about us?"),
  extraNotes: z.string().optional(),
})

export const castingSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Valid email required"),
  phone: z.string().min(7, "Phone number required"),
  cityState: z.string().min(1, "Location is required"),
  headshotUrl: z.string().url("Enter a valid URL").or(z.literal("")),
  height: z.string().optional(),
  build: z.string().optional(),
  ageRange: z.string().optional(),
  experienceLevel: z.enum([
    "No Experience",
    "Some",
    "Trained",
    "Professional",
  ]),
  unionStatus: z.enum(["Non-union", "SAG-eligible", "SAG-AFTRA"]),
  reelLink: z.string().url("Enter a valid URL").or(z.literal("")),
  specialSkills: z.string().optional(),
  roleWillingness: z
    .array(
      z.enum([
        "Lead roles",
        "Supporting",
        "Background",
        "Commercial",
        "All of the above",
      ])
    )
    .min(1, "Select at least one"),
  representation: z.string().optional(),
  referralSource: z.string().min(1, "How did you hear about us?"),
})

export const locationSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Valid email required"),
  phone: z.string().min(7, "Phone number required"),
  address: z.string().min(1, "Address or general area is required"),
  area: z.string().optional(),
  locationType: z.enum([
    "Home",
    "Business",
    "Outdoor",
    "Industrial",
    "Historic",
    "Church",
    "Restaurant",
    "Other",
  ]),
  description: z.string().min(10, "Describe the location"),
  photoUrls: z.string().optional(),
  availability: z.enum([
    "Anytime",
    "Weekdays",
    "Weekends",
    "By Arrangement",
  ]),
  restrictions: z.string().optional(),
  compensation: z.enum(["Free", "Trade", "Paid", "Negotiable"]),
  referralSource: z.string().min(1, "How did you hear about us?"),
})

export type CrewFormData = z.infer<typeof crewSchema>
export type CastingFormData = z.infer<typeof castingSchema>
export type LocationFormData = z.infer<typeof locationSchema>
