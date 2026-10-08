// THE HOMEPAGE'S WORDS (website-redesign SPEC Feature 5; Sam 10/8 ~11:05: "Use our new positioning - we're humble
// storytellers in an age of endless content."). Every visitor-facing string lives here with its source, so
// lib/home-copy.test.ts can hold the house voice over all of it.
//
// Rules this file keeps:
//   - Sam's OWN words only (his 10/8 voice memo, the 10/7 rulings, or approved site copy). A missing line is OPEN,
//     never filled with marketing copy.
//   - Humility is shown, not boasted (Sam 10/7: "I genuinely want the brand to be humble"): no superlatives. The
//     one place the page says "humble" is Sam's own differentiator line (10/8 12:02, "we're humble, I guess").
//   - His landing-video script file is never edited (thread 8). The memo lines are quoted from his raw transcript;
//     when his reworked script lands, these follow it.
// src tags: SAM <when/where> · SITE (approved site copy or the ruled tagline) · OPEN (needs his words).

export interface Line {
  t: string
  src: string
}

const L = (t: string, src: string): Line => ({ t, src })

export const HOME = {
  heroEyebrow: L("Video production · Covington, KY", "SITE"),
  // The H1 is the ruled tagline (Sam 9/23; 10/7 22:45 "B is the headline"), set in the page with its accent.
  heroSub: L("Made by people who come from the movie business.", "SITE (ruled with the tagline, 10/7 22:45)"),
  pitch: L(
    "Anyone can make content now. Getting a real person to come through the screen, so people believe you, takes craft. That’s what we do.",
    "SAM 10/7 22:45 (pitch A: 'A is the pitch that follows')",
  ),
  draftPill: L("Draft · 10/8/26 · copy awaiting Sam", "marker (staging review)"),

  videoEyebrow: L("From Sam", "OPEN (a label)"),
  videoH2: L("Hear it from me.", "SITE (/service-businesses, approved 9/27)"),
  videoLabel: L("Sam’s intro video goes here", "placeholder label (Majordomo brief 10/8 11:05)"),

  storyH2: L("You don’t need content. You need trust.", "SAM 10/7 13:15 (held as a section line, 10/7 22:45)"),
  story: [
    L(
      "Content, to me, is something that’s designed to steal your attention. It’s designed to get engagement, which really means stealing your attention so it can be sold to advertisers.",
      "SAM 10/8 memo l.2",
    ),
    L("The world’s awash in content. The world doesn’t need more content.", "SAM 10/8 memo l.2"),
    L(
      "What the world needs are stories. Stories can earn your attention. They can hold your attention, and then they can build trust.",
      "SAM 10/8 memo l.3",
    ),
    L(
      "Today, it’s easier than ever to capture content, but it’s just as important as ever to put the right energy and time into shaping stories from what you capture.",
      "SAM 10/8 memo l.4",
    ),
    L(
      "Two machines can talk to each other in content. But it takes humans talking to humans to tell a story.",
      "SAM 10/8 memo l.6",
    ),
  ],

  whatWeDo: L(
    "We help our clients use 21st-century technology for the timeless human endeavor of telling each other stories.",
    "SAM 10/8 memo l.5 (as tidied in his DRAFT1)",
  ),

  diyH2: L("I believe everybody’s a filmmaker inside.", "SAM 10/8 memo l.7"),
  diyBody: L(
    "If you’re just getting started and want to make better videos for your business, check out the resources here on our website.",
    "SAM 10/8 memo l.7, tidied ('a lot of' left out: there are two resources today)",
  ),
  diyFaq: L("Questions people ask us", "the FAQ page’s h1 (NEW, 10/8)"),
  diyGuide: L("How to shoot a customer testimonial on your iPhone (PDF)", "the guide’s own title"),

  // WHY US (Sam 10/8 ~12:02): 'the movie credits should begin a "why us" i.e. not someone else section - that pitch
  // is - we're serious filmmakers, we're a nimble operation, and we're humble, I guess. The differentiators.'
  // His three lines are used as he said them; the words under the last two are his to write (OPEN).
  whyEyebrow: L("Why us", "SAM 10/8 12:02"),
  whyH2: L("We’re serious filmmakers.", "SAM 10/8 12:02"),
  whyLede: L(
    "We’ve spent years working on Hollywood film sets. These are some of the movies and shows.",
    "SITE (the credits band, 9/27)",
  ),
  whyNimble: L("We’re a nimble operation.", "SAM 10/8 12:02"),
  whyHumble: L("And we’re humble.", "SAM 10/8 12:02 ('and we're humble, I guess')"),
  whyOpen: L("Open · Sam’s words go here", "OPEN (marker under the last two differentiators)"),
  creditsLabel: L("Film credits", "SITE (the old section's eyebrow)"),
  drift: L("Pause the posters", "control label (WCAG 2.2.2: moving content needs a pause)"),

  closeEyebrow: L("Get started", "SITE"),
  closeH2: L("Let’s do this together.", "SAM 10/8 memo l.6"),
  closeLede: L("When you’re ready to tell your story, book a call.", "SAM 10/8 memo l.6-7, tidied"),
  closeBody: L(
    "Book a free call and tell us what you need. We’ll tell you how we’d shoot it and what it would cost.",
    "SITE (9/27)",
  ),
} as const

/** Every Line on the page, flattened, for the tests and the proposal's source table. */
export function allLines(): Line[] {
  const out: Line[] = []
  for (const v of Object.values(HOME)) {
    if (Array.isArray(v)) out.push(...v)
    else out.push(v as Line)
  }
  return out
}
