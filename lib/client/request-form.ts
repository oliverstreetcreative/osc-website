// Start a project v3 (SPEC §31 v2): the old portal's form v5, Sam's six 10/8 changes included, for a SIGNED-IN client,
// one section per screen, saved as she goes. Pure: the screens and questions as data, a screen's form post parsed and
// checked, the review summary, the queue's v5 `data` (the old form's own field names, so new-project's intake reads it
// the same way), and the card's title. No database, no Next: tested in request-form.test.ts.

export const STEPS = ["about", "project", "timing", "money", "assets", "creative", "rights", "else"] as const
export type Step = (typeof STEPS)[number]
export const isStep = (s: string): s is Step => (STEPS as readonly string[]).includes(s)

export type Choice = { value: string; label: string }
type Base = { name: string; label: string; help?: string; required?: boolean; placeholder?: string }
export type TextField = Base & { type: "text" | "url" | "tel" | "email" | "long"; max: number }
export type ChoiceField = Base & { type: "radio" | "select" | "checks"; choices: Choice[] }
export type YesNoField = Base & { type: "yesno" }
export type CheckField = Base & { type: "check"; showWhen?: "posting" }
export type Column =
  | { name: string; label: string; type: "select"; choices: Choice[]; other?: string; required?: boolean }
  | { name: string; label: string; type: "number"; min: number; max: number; default: number }
  | { name: string; label: string; type: "text"; max: number; placeholder?: string }
  | { name: string; label: string; type: "checks"; choices: Choice[] }
export type RowsField = Base & { type: "rows"; columns: Column[]; minRows: number; maxRows: number; addText: string }
export type Field = TextField | ChoiceField | YesNoField | CheckField | RowsField
export type Screen = { step: Step; title: string; intro?: string; fields: Field[]; billing?: string[]; shoot?: string[] }

export const SHORT = 200
export const LONG = 2000
/** What a draft keeps at most for one text answer: over-long text is kept and flagged, never cut, up to this. */
export const CEILING = 10_000
export const MAX_DELIVERABLES = 20
export const MAX_HANDLES = 10

const plain = (values: string[]): Choice[] => values.map((v) => ({ value: v, label: v }))
const OTHER = "other" // v5: "Something else…" is SurveyJS's other item; onboard reads item: "other" + "item-Comment"

/** v5's questions and words, exactly (apart from the four "About you" fields the session already knows). */
export const SCREENS: Record<Step, Screen> = {
  about: {
    step: "about",
    title: "About you",
    fields: [
      { name: "submitter_phone", label: "Phone", type: "tel", max: 40 },
      {
        name: "submitter_role",
        label: "Your role / title",
        type: "text",
        max: SHORT,
        help: "Marketing director, campaign manager, executive producer, whatever captures how you fit into the project.",
      },
      {
        name: "company_website",
        label: "The brand's website",
        type: "url",
        max: SHORT,
        help: "The brand this video is for, not your agency's or PR firm's site. We want to know what we're selling.",
      },
    ],
  },
  project: {
    step: "project",
    title: "The project",
    fields: [
      {
        name: "project_summary",
        label: "What are we making, and for whom?",
        help: "One to three sentences. A pitch, not a brief.",
        type: "long",
        max: LONG,
        required: true,
      },
      {
        name: "project_type",
        label: "What kind of project is this?",
        type: "radio",
        choices: [
          { value: "commercial", label: "Commercial" },
          { value: "political", label: "Political" },
          { value: "documentary", label: "Documentary" },
          { value: "corporate", label: "Corporate / brand" },
          { value: "music-video", label: "Music video" },
          { value: "event", label: "Event coverage" },
          { value: "edit-only", label: "Edit / post only" },
          { value: "other", label: "Other" },
        ],
      },
      {
        name: "deliverables",
        label: "What do you need delivered?",
        help: "Add a line for each piece you want, like ringing up an order. Not sure yet? Put your best guess and we'll firm it up in the proposal.",
        type: "rows",
        minRows: 1,
        maxRows: MAX_DELIVERABLES,
        addText: "+ Add another deliverable",
        required: true,
        columns: [
          {
            name: "item",
            label: "Deliverable",
            type: "select",
            required: true,
            other: "Something else…",
            choices: plain([
              "TV / broadcast spot",
              "Online / pre-roll spot",
              "Social cutdown",
              "Long-form video (2–10 min)",
              "Documentary / short film",
              "Sizzle or teaser",
              "Interview / testimonial",
              "Event recap",
              "Photo stills",
              "Captions / subtitles",
              "Raw footage handoff",
            ]),
          },
          { name: "qty", label: "How many", type: "number", min: 1, max: 99, default: 1 },
          { name: "length", label: "Length", type: "text", max: SHORT, placeholder: "30s, 2 min, TBD…" },
          { name: "aspect", label: "Crops needed", type: "checks", choices: plain(["16:9", "9:16", "1:1", "4:5"]) },
          { name: "notes", label: "Notes", type: "text", max: SHORT },
        ],
      },
      {
        name: "deliverable_format",
        label: "Where will it live?",
        type: "select",
        choices: [
          { value: "broadcast", label: "Broadcast TV" },
          { value: "social", label: "Social media" },
          { value: "web", label: "Website / embedded" },
          { value: "internal", label: "Internal (training, sales, etc.)" },
          { value: "mixed", label: "A mix of the above" },
        ],
      },
    ],
  },
  timing: {
    step: "timing",
    title: "Timing & location",
    shoot: ["desired_shoot_dates", "shoot_location", "on_shoot_contact", "parking_notes"],
    fields: [
      {
        name: "has_shoot",
        label: "Is there a shoot?",
        help: "If we’re working with footage that already exists, there’s no shoot, and the shoot questions below will disappear.",
        type: "radio",
        choices: [
          { value: "yes", label: "Yes, we’re filming something new" },
          { value: "none", label: "No, edit only. The footage already exists" },
          { value: "tbd", label: "Not sure yet" },
        ],
      },
      { name: "desired_shoot_dates", label: "Ideal shoot date(s)", help: "Flexible, locked, or TBD: all fine.", type: "text", max: SHORT },
      { name: "delivery_deadline", label: "Delivery deadline", help: "When do you need it in hand? If it’s flexible, say so.", type: "text", max: SHORT },
      {
        name: "hard_dates",
        label: "Hard dates or external constraints?",
        help: "Election day, launch event, trade show, vacation: anything we should plan around.",
        type: "long",
        max: LONG,
      },
      {
        name: "shoot_location",
        label: "Where's the shoot?",
        help: "Our studio at 521 Oliver St, your office, on location, TBD. Address or general area is fine.",
        type: "text",
        max: SHORT,
      },
      { name: "on_shoot_contact", label: "On-shoot contact", help: "Name + phone for whoever's running point from your side the day of.", type: "text", max: SHORT },
      { name: "parking_notes", label: "Parking / access notes", type: "long", max: LONG },
    ],
  },
  money: {
    step: "money",
    title: "Money & decision-makers",
    billing: ["billing_contact_name", "billing_email", "billing_phone", "billing_address", "tax_classification", "w9_status"],
    fields: [
      {
        name: "budget_range",
        label: "Budget range",
        help: "Rough is fine. We'll write a detailed proposal once we know more.",
        type: "select",
        choices: [
          { value: "under-1k", label: "Under $1,000" },
          { value: "1-5k", label: "$1,000 – $5,000" },
          { value: "5-15k", label: "$5,000 – $15,000" },
          { value: "15-50k", label: "$15,000 – $50,000" },
          { value: "50k+", label: "$50,000+" },
          { value: "TBD", label: "TBD" },
        ],
      },
      {
        name: "quoted_price",
        label: "Were you quoted a rate or price already?",
        help: "If anyone at OSC gave you a number (an hourly rate, a day rate, a ballpark), put it here exactly as you heard it, and who said it. We'll honour it.",
        type: "long",
        max: LONG,
      },
      { name: "decision_maker", label: "Who approves creative?", help: "The person whose yes means yes on the final cut.", type: "text", max: SHORT },
      { name: "invoice_approver", label: "Who approves the invoice?", help: "Often the same as above, but not always.", type: "text", max: SHORT },
      { name: "billing_contact_name", label: "Billing contact name", type: "text", max: SHORT },
      { name: "billing_email", label: "Billing email", type: "email", max: SHORT },
      { name: "billing_phone", label: "Billing phone", type: "tel", max: 40 },
      { name: "billing_address", label: "Billing address", type: "long", max: LONG },
      {
        name: "tax_classification",
        label: "Tax classification",
        help: "LLC, S-corp, sole prop, 501(c)(3), PAC, campaign committee: whatever applies.",
        type: "text",
        max: SHORT,
      },
      {
        name: "w9_status",
        label: "Your W-9",
        help: "We need one on file to invoice you. If we've worked together before, it may already be there.",
        type: "radio",
        choices: [
          { value: "on_file", label: "Already on file with OSC" },
          { value: "will_send", label: "We'll email ours over" },
          { value: "need_form", label: "Send us a blank W-9 to fill in" },
        ],
      },
    ],
  },
  assets: {
    step: "assets",
    title: "Your brand assets",
    intro: "The more of your look we have up front, the closer the first cut lands.",
    fields: [{ name: "brand_assets_later", label: "I'll send these later", type: "check" }],
  },
  creative: {
    step: "creative",
    title: "Creative direction",
    fields: [
      {
        name: "script_status",
        label: "Script status",
        type: "radio",
        choices: [
          { value: "have-script", label: "We have a finished script" },
          { value: "have-brief", label: "We have a brief / outline" },
          { value: "need-to-develop", label: "We need help developing it" },
          { value: "you-write-it", label: "You're writing it (OSC)" },
        ],
      },
      {
        name: "reference_reels",
        label: "Reference reels / inspiration",
        help: "Links to anything that captures the vibe. Commercials, films, YouTube videos, mood boards. Drop URLs or describe what you're going for.",
        type: "long",
        max: LONG,
      },
      { name: "music_style", label: "Music style", help: "Cinematic, indie, stock, licensed, none, or just a vibe.", type: "text", max: SHORT },
      { name: "pacing_tone", label: "Pacing / tone in a few words", help: "Fast cuts, slow and contemplative, funny, urgent, elegiac, etc.", type: "text", max: SHORT },
      {
        name: "logo_notes",
        label: "Logo notes",
        help: "Where is your logo? Is it locked or being redesigned? We can work from whatever you have.",
        type: "long",
        max: LONG,
      },
      { name: "color_palette", label: "Color palette", help: "Hex codes, Pantone refs, or just \"our usual\".", type: "text", max: SHORT },
      { name: "font_preferences", label: "Font preferences", type: "text", max: SHORT },
      { name: "tagline", label: "Tagline or slogan", type: "text", max: SHORT },
    ],
  },
  rights: {
    step: "rights",
    title: "Rights & distribution",
    intro:
      "These questions are about the underlying rights we license for you, like music and stock footage, so you have them where you need them, for as long as you need them. Unless otherwise negotiated, your license from OSC to use the finished video is perpetual. This is only about the pieces inside it.",
    fields: [
      {
        name: "platforms",
        label: "Where will this play?",
        type: "checks",
        choices: [
          { value: "broadcast", label: "Broadcast TV" },
          { value: "cable", label: "Cable" },
          { value: "streaming", label: "Streaming (OTT)" },
          { value: "instagram", label: "Instagram" },
          { value: "facebook", label: "Facebook" },
          { value: "tiktok", label: "TikTok" },
          { value: "youtube", label: "YouTube" },
          { value: "website", label: "Your website" },
          { value: "internal", label: "Internal use" },
        ],
      },
      { name: "territory", label: "Territory", help: "U.S., regional, Kentucky, global: whatever matters for licensing.", type: "text", max: SHORT },
      { name: "term_length", label: "Usage term", help: "How long will you need the rights? 6 months, 1 year, perpetuity, etc.", type: "text", max: SHORT },
      {
        name: "social_handles",
        label: "Social handles for tagging",
        help: "Where should we credit the piece when it goes live?",
        type: "rows",
        minRows: 0,
        maxRows: MAX_HANDLES,
        addText: "Add another",
        columns: [
          { name: "platform", label: "Platform", type: "select", choices: plain(["Instagram", "TikTok", "YouTube", "Facebook", "LinkedIn", "X", "Threads", "Other"]) },
          { name: "handle", label: "Handle", type: "text", max: SHORT, placeholder: "@yourbrand" },
        ],
      },
      { name: "osc_may_post_piece", label: "Can we post a short social video about the finished piece?", type: "yesno" },
      { name: "osc_may_post_bts", label: "Can we post a behind-the-scenes or making-of video?", type: "yesno" },
      { name: "osc_post_approval", label: "We'd like to approve these posts first", type: "check", showWhen: "posting" },
    ],
  },
  else: {
    step: "else",
    title: "Anything else",
    fields: [{ name: "anything_else", label: "Anything else?", type: "long", max: LONG }],
  },
}

// ------------------------------------------------------------------------------------------------- values + parsing

export type Row = Record<string, string | string[]>
export type Value = string | string[] | boolean | Row[]
export type ScreenValues = Record<string, Value>
/** A draft's answers, one object per screen (a screen saves its own key, so two devices can't wipe each other). */
export type Answers = Partial<Record<Step, ScreenValues>>

/** Text as the client typed it, made safe to keep: no control, format or direction characters; bounded. */
const CONTROL_OR_FORMAT = new RegExp("[\\p{Cc}\\p{Cf}]", "gu")
// Supplementary variation selectors hide text Sam can't see but a model reading the queue can (the old cleanText's
// rule, kept: built review 10/8); a run of ordinary selectors keeps one (emoji use one).
const SUPPLEMENTARY_VARIATION = new RegExp("[\\u{E0100}-\\u{E01EF}]", "gu")
const VARIATION_RUN = new RegExp("[\\u{FE00}-\\u{FE0F}]{2,}", "gu")
export function cleanTyped(raw: string, max = CEILING): string {
  return raw
    .replace(/\r\n?/g, "\n")
    .replace(CONTROL_OR_FORMAT, (c) => (c === "\n" || c === "\t" ? c : ""))
    .replace(SUPPLEMENTARY_VARIATION, "")
    .replace(VARIATION_RUN, (m) => m[0])
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, max)
}

/** A form post as the route sees it: every name with all its values. */
export type Posted = { get: (name: string) => string | null; getAll: (name: string) => string[] }

const choiceValues = (choices: Choice[]) => new Set(choices.map((c) => c.value))

function rowCount(posted: Posted, field: RowsField): number {
  const n = Number(posted.get(`${field.name}.count`) ?? "0")
  return Number.isInteger(n) && n >= 0 ? Math.min(n, field.maxRows) : 0
}

function parseRow(posted: Posted, field: RowsField, i: number): Row {
  const row: Row = {}
  for (const c of field.columns) {
    const key = `${field.name}.${i}.${c.name}`
    if (c.type === "checks") {
      const ok = choiceValues(c.choices)
      row[c.name] = posted.getAll(key).filter((v) => ok.has(v))
    } else if (c.type === "select") {
      const v = posted.get(key) ?? ""
      row[c.name] = v === OTHER || choiceValues(c.choices).has(v) ? v : ""
      if (c.other) row[`${c.name}_other`] = cleanTyped(posted.get(`${key}_other`) ?? "")
    } else {
      row[c.name] = cleanTyped(posted.get(key) ?? "")
    }
  }
  return row
}

const emptyRow = (field: RowsField): Row => {
  const r: Row = {}
  for (const c of field.columns) r[c.name] = c.type === "checks" ? [] : c.type === "number" ? String(c.default) : ""
  return r
}

/** What a row button asked for: "add:deliverables", or "remove:deliverables:2". */
export function rowOp(op: string): { kind: "add" | "remove"; field: string; index: number } | null {
  const m = /^(add|remove):([a-z_]+)(?::(\d{1,2}))?$/.exec(op)
  if (!m) return null
  const kind = m[1] as "add" | "remove"
  if (kind === "remove" && m[3] === undefined) return null
  return { kind, field: m[2], index: m[3] === undefined ? -1 : Number(m[3]) }
}

/**
 * One screen's post → the values to save. Every text is kept as typed (cleaned, up to CEILING; flagged later if over
 * its own limit), every choice must be one of v5's own (anything else is dropped, never defaulted), and a row button
 * adds or removes a row before saving.
 */
export function parseScreen(step: Step, posted: Posted, op = ""): ScreenValues {
  const screen = SCREENS[step]
  const out: ScreenValues = {}
  const rop = rowOp(op)
  for (const f of screen.fields) {
    if (f.type === "rows") {
      let rows = Array.from({ length: rowCount(posted, f) }, (_, i) => parseRow(posted, f, i))
      if (rop && rop.field === f.name) {
        if (rop.kind === "add" && rows.length < f.maxRows) rows.push(emptyRow(f))
        if (rop.kind === "remove" && rop.index >= 0 && rop.index < rows.length) rows = rows.filter((_, i) => i !== rop.index)
      }
      while (rows.length < f.minRows) rows.push(emptyRow(f))
      out[f.name] = rows
    } else if (f.type === "checks") {
      const ok = choiceValues(f.choices)
      out[f.name] = posted.getAll(f.name).filter((v) => ok.has(v))
    } else if (f.type === "radio" || f.type === "select") {
      const v = posted.get(f.name) ?? ""
      out[f.name] = choiceValues(f.choices).has(v) ? v : ""
    } else if (f.type === "yesno") {
      const v = posted.get(f.name)
      out[f.name] = v === "yes" ? "yes" : v === "no" ? "no" : ""
    } else if (f.type === "check") {
      out[f.name] = posted.get(f.name) === "on"
    } else {
      out[f.name] = cleanTyped(posted.get(f.name) ?? "")
    }
  }
  // The shoot questions don't apply to an edit-only job: dropped, so nothing stale rides along.
  if (step === "timing" && out.has_shoot === "none") for (const n of screen.shoot ?? []) out[n] = ""
  // "Approve these posts first" only means something when either posting answer is yes.
  if (step === "rights" && out.osc_may_post_piece !== "yes" && out.osc_may_post_bts !== "yes") out.osc_post_approval = false
  return out
}

// ------------------------------------------------------------------------------------------------- checks

export type Problems = Record<string, string>
const str = (v: Value | undefined) => (typeof v === "string" ? v : "")

/** What's wrong on one screen (field name, or "deliverables.0.item", → plain words). Empty = complete. */
export function screenProblems(step: Step, values: ScreenValues, ctx: { files?: number } = {}): Problems {
  const p: Problems = {}
  for (const f of SCREENS[step].fields) {
    if (f.type === "rows") {
      const rows = Array.isArray(values[f.name]) ? (values[f.name] as Row[]) : []
      rows.forEach((row, i) => {
        for (const c of f.columns) {
          const v = row[c.name]
          if (c.type === "select" && c.required && !v) p[`${f.name}.${i}.${c.name}`] = "Pick one."
          if (c.type === "select" && c.other && v === OTHER && !str(row[`${c.name}_other`])) p[`${f.name}.${i}.${c.name}_other`] = "Say what it is."
          if (c.type === "number" && typeof v === "string" && v !== "") {
            const n = Number(v)
            if (!Number.isInteger(n) || n < c.min || n > c.max) p[`${f.name}.${i}.${c.name}`] = `A number from ${c.min} to ${c.max}.`
          }
          if (c.type === "text" && typeof v === "string" && v.length > c.max) p[`${f.name}.${i}.${c.name}`] = `This is over ${c.max.toLocaleString()} characters.`
          if (c.type === "select" && c.other && str(row[`${c.name}_other`]).length > SHORT) p[`${f.name}.${i}.${c.name}_other`] = `This is over ${SHORT} characters.`
        }
      })
      if (f.required && !rows.some((r) => r.item)) p[f.name] = "Add at least one thing you need delivered."
      continue
    }
    const v = values[f.name]
    if ((f.type === "text" || f.type === "url" || f.type === "tel" || f.type === "email" || f.type === "long") && typeof v === "string") {
      if (v.length > f.max) p[f.name] = `This is over ${f.max.toLocaleString()} characters.`
      if (f.type === "email" && v && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) p[f.name] = "That isn't an email address."
    }
    if (f.required && !str(v)) p[f.name] = "This one's needed."
  }
  if (step === "assets" && !values.brand_assets_later && !(ctx.files && ctx.files > 0)) {
    p.brand_assets = "Upload at least one file, or tick \"I'll send these later\"."
  }
  return p
}

/** Every screen's problems, in order (Send's check); the first screen with any is where she's sent back to. */
export function allProblems(answers: Answers, files: number): { step: Step; problems: Problems }[] {
  return STEPS.map((step) => ({ step, problems: screenProblems(step, answers[step] ?? {}, { files }) })).filter((x) => Object.keys(x.problems).length)
}

export const nextStep = (s: Step): Step | "review" => (STEPS.indexOf(s) === STEPS.length - 1 ? "review" : STEPS[STEPS.indexOf(s) + 1])
export const prevStep = (s: Step): Step => STEPS[Math.max(0, STEPS.indexOf(s) - 1)]
export const stepNumber = (s: Step) => STEPS.indexOf(s) + 1

// ------------------------------------------------------------------------------------------------- title + summary

// Money words only: a "$", or dollars/USD/budget/bucks. ("A 4K brand film for 1,200 donors" keeps its title.)
const MONEY = /\$|\b(dollars?|usd|budget|bucks)\b/i

/** The card's title: the pitch's first sentence, up to ~70 characters cut at a word. Never money (Home is words only). */
export function requestTitle(answers: Answers): string {
  const pitch = str(answers.project?.project_summary).replace(/\s+/g, " ").trim()
  if (!pitch) return "Your project request"
  const first = pitch.split(/(?<=[.!?])\s/)[0].replace(/[.!?]+$/, "")
  if (MONEY.test(first)) return "Your project request"
  if (first.length <= 70) return first
  const cut = first.slice(0, 70)
  const at = cut.lastIndexOf(" ")
  return `${(at > 30 ? cut.slice(0, at) : cut).replace(/[,;:\s]+$/, "")}…`
}

const labelOf = (choices: Choice[], v: string) => choices.find((c) => c.value === v)?.label ?? v

export type SummaryGroup = { step: Step; title: string; rows: { label: string; value: string }[] }

/** Her answers, grouped by screen, in plain words (the review screen and the request page). Money only for people who
 *  see money; files by name only. */
export function summary(answers: Answers, opts: { seesMoney: boolean; files: { name: string }[]; later: boolean }): SummaryGroup[] {
  const groups: SummaryGroup[] = []
  for (const step of STEPS) {
    if (step === "money" && !opts.seesMoney) continue
    const values = answers[step] ?? {}
    const rows: { label: string; value: string }[] = []
    if (step === "assets") {
      if (opts.files.length) rows.push({ label: "Uploaded", value: opts.files.map((f) => f.name).join(", ") })
      if (opts.later) rows.push({ label: "The rest", value: "I'll send these later" })
    }
    for (const f of SCREENS[step].fields) {
      const v = values[f.name]
      if (f.type === "rows") {
        const rs = Array.isArray(v) ? (v as Row[]) : []
        rs.forEach((r, i) => {
          if (f.name === "deliverables") {
            const what = r.item === OTHER ? str(r.item_other) : str(r.item)
            if (!what) return
            const bits = [`${str(r.qty) || "1"} × ${what}`, str(r.length), (r.aspect as string[] | undefined)?.join(", "), str(r.notes)].filter(Boolean)
            rows.push({ label: i === 0 ? f.label : "", value: bits.join(" · ") })
          } else {
            const bits = [str(r.platform), str(r.handle)].filter(Boolean)
            if (bits.length) rows.push({ label: rows.some((x) => x.label === f.label) ? "" : f.label, value: bits.join(" ") })
          }
        })
        continue
      }
      if (f.type === "check") {
        if (v === true && f.name !== "brand_assets_later") rows.push({ label: f.label, value: "Yes" })
        continue
      }
      if (f.type === "yesno") {
        if (v === "yes" || v === "no") rows.push({ label: f.label, value: v === "yes" ? "Yes" : "No" })
        continue
      }
      if (f.type === "checks") {
        const vs = Array.isArray(v) ? (v as string[]) : []
        if (vs.length) rows.push({ label: f.label, value: vs.map((x) => labelOf(f.choices, x)).join(", ") })
        continue
      }
      if (f.type === "radio" || f.type === "select") {
        if (str(v)) rows.push({ label: f.label, value: labelOf(f.choices, str(v)) })
        continue
      }
      if (str(v)) rows.push({ label: f.label, value: str(v) })
    }
    groups.push({ step, title: SCREENS[step].title, rows })
  }
  return groups
}

// ------------------------------------------------------------------------------------------------- the queue's v5 data

export type StoredFile = { n: number; name: string; stored: string; type: string; size: number; path: string; at: string; removed_at?: string | null }

/**
 * The queue file's `data`, keyed by v5's own names (so new-project's intake reads it exactly as it reads the old
 * form): who she is from the session; deliverable rows as {item, qty, length, aspect, notes}, with "Something else…"
 * as item "other" + "item-Comment"; files as {name, type, content: the stored path}; yes/no answers as booleans.
 */
export function queueData(answers: Answers, who: { name: string; company: string; email: string }, files: StoredFile[]) {
  const a = answers
  const v = (step: Step, name: string) => a[step]?.[name]
  const text = (step: Step, name: string) => str(v(step, name)) || undefined
  const yes = (step: Step, name: string) => (v(step, name) === "yes" ? true : v(step, name) === "no" ? false : undefined)
  const deliverables = ((v("project", "deliverables") as Row[] | undefined) ?? [])
    .filter((r) => r.item)
    .map((r) => {
      const qty = Number(str(r.qty) || "1")
      const out: Record<string, unknown> = { item: str(r.item), qty: Number.isInteger(qty) ? qty : 1 }
      if (r.item === OTHER) out["item-Comment"] = str(r.item_other)
      if (str(r.length)) out.length = str(r.length)
      if ((r.aspect as string[] | undefined)?.length) out.aspect = r.aspect
      if (str(r.notes)) out.notes = str(r.notes)
      return out
    })
  const handles = ((v("rights", "social_handles") as Row[] | undefined) ?? [])
    .filter((r) => str(r.platform) || str(r.handle))
    .map((r) => ({ ...(str(r.platform) ? { platform: str(r.platform) } : {}), ...(str(r.handle) ? { handle: str(r.handle) } : {}) }))
  const live = files.filter((f) => !f.removed_at)
  const noShoot = v("timing", "has_shoot") === "none"
  const data: Record<string, unknown> = {
    submitter_name: who.name,
    submitter_company: who.company,
    submitter_email: who.email,
    submitter_phone: text("about", "submitter_phone"),
    submitter_role: text("about", "submitter_role"),
    company_website: text("about", "company_website"),
    project_summary: text("project", "project_summary"),
    project_type: text("project", "project_type"),
    deliverables,
    deliverable_format: text("project", "deliverable_format"),
    has_shoot: text("timing", "has_shoot"),
    desired_shoot_dates: noShoot ? undefined : text("timing", "desired_shoot_dates"),
    delivery_deadline: text("timing", "delivery_deadline"),
    hard_dates: text("timing", "hard_dates"),
    shoot_location: noShoot ? undefined : text("timing", "shoot_location"),
    on_shoot_contact: noShoot ? undefined : text("timing", "on_shoot_contact"),
    parking_notes: noShoot ? undefined : text("timing", "parking_notes"),
    budget_range: text("money", "budget_range"),
    quoted_price: text("money", "quoted_price"),
    decision_maker: text("money", "decision_maker"),
    invoice_approver: text("money", "invoice_approver"),
    billing_contact_name: text("money", "billing_contact_name"),
    billing_email: text("money", "billing_email"),
    billing_phone: text("money", "billing_phone"),
    billing_address: text("money", "billing_address"),
    tax_classification: text("money", "tax_classification"),
    w9_status: text("money", "w9_status"),
    script_status: text("creative", "script_status"),
    reference_reels: text("creative", "reference_reels"),
    music_style: text("creative", "music_style"),
    pacing_tone: text("creative", "pacing_tone"),
    brand_assets: live.map((f) => ({ name: f.name, type: f.type, content: f.path })),
    brand_assets_later: v("assets", "brand_assets_later") === true,
    logo_notes: text("creative", "logo_notes"),
    color_palette: text("creative", "color_palette"),
    font_preferences: text("creative", "font_preferences"),
    tagline: text("creative", "tagline"),
    platforms: (v("rights", "platforms") as string[] | undefined) ?? [],
    territory: text("rights", "territory"),
    term_length: text("rights", "term_length"),
    social_handles: handles,
    osc_may_post_piece: yes("rights", "osc_may_post_piece"),
    osc_may_post_bts: yes("rights", "osc_may_post_bts"),
    osc_post_approval: v("rights", "osc_post_approval") === true ? true : undefined,
    anything_else: text("else", "anything_else"),
  }
  for (const k of Object.keys(data)) if (data[k] === undefined) delete data[k]
  return data
}

/** Every field in `data` that holds the client's own words (quoted as data downstream, never followed). */
export function clientTypedFields(data: Record<string, unknown>): string[] {
  const typed: string[] = []
  const free = [
    "submitter_phone", "submitter_role", "company_website", "project_summary", "desired_shoot_dates", "delivery_deadline",
    "hard_dates", "shoot_location", "on_shoot_contact", "parking_notes", "quoted_price", "decision_maker", "invoice_approver",
    "billing_contact_name", "billing_email", "billing_phone", "billing_address", "tax_classification", "reference_reels",
    "music_style", "pacing_tone", "logo_notes", "color_palette", "font_preferences", "tagline", "territory", "term_length",
    "anything_else",
  ]
  for (const k of free) if (typeof data[k] === "string" && data[k]) typed.push(`data.${k}`)
  ;(data.deliverables as Record<string, unknown>[] | undefined)?.forEach((r, i) => {
    for (const k of ["item-Comment", "length", "notes"]) if (typeof r[k] === "string" && r[k]) typed.push(`data.deliverables[${i}].${k}`)
  })
  ;(data.social_handles as Record<string, unknown>[] | undefined)?.forEach((r, i) => {
    if (typeof r.handle === "string" && r.handle) typed.push(`data.social_handles[${i}].handle`)
  })
  ;(data.brand_assets as unknown[] | undefined)?.forEach((_, i) => typed.push(`data.brand_assets[${i}].name`))
  return typed
}

// ------------------------------------------------------------------------------------------------- files

/** v5's file types (acceptedTypes), lower-case, with the dot. */
export const FILE_TYPES = [".pdf", ".png", ".jpg", ".jpeg", ".svg", ".ai", ".eps", ".psd", ".zip", ".otf", ".ttf", ".woff", ".woff2", ".txt", ".doc", ".docx", ".key", ".pptx"]
export const MAX_FILE_BYTES = 25 * 1024 * 1024
export const MAX_FILES = 20

/** A file's stored name: its number first (never collides), a safe stem, its own extension. Null = a type we don't take. */
export function storedName(n: number, original: string): string | null {
  const base = original.replace(/\\/g, "/").split("/").pop() ?? ""
  const dot = base.lastIndexOf(".")
  const ext = dot > 0 ? base.slice(dot).toLowerCase() : ""
  if (!FILE_TYPES.includes(ext)) return null
  const stem =
    base
      .slice(0, dot)
      .normalize("NFKD")
      .replace(new RegExp("\\p{M}", "gu"), "") // accents go (é → e); any other non-ASCII separates words
      .replace(/[^\x20-\x7e]/g, " ")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "file"
  return `${String(n).padStart(2, "0")}_${stem}${ext}`
}

const TYPES: Record<string, string> = {
  ".pdf": "application/pdf", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".svg": "image/svg+xml",
  ".ai": "application/postscript", ".eps": "application/postscript", ".psd": "image/vnd.adobe.photoshop",
  ".zip": "application/zip", ".otf": "font/otf", ".ttf": "font/ttf", ".woff": "font/woff", ".woff2": "font/woff2",
  ".txt": "text/plain", ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document", ".key": "application/vnd.apple.keynote",
  ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
}
/** A stored file's type, from its extension (never what the browser said). */
export const fileType = (stored: string) => TYPES[stored.slice(stored.lastIndexOf(".")).toLowerCase()] ?? "application/octet-stream"

/** The name she sees: her own file name, cleaned and bounded (never a path). */
export const shownName = (original: string) => cleanTyped(original.replace(/\\/g, "/").split("/").pop() ?? "", 120) || "file"
