// THE PUBLIC SITE'S FRAME. One design system with the client site (Sam, 10/3 01:20:
// "redesign the website … in this vein"): the public pages sit inside the same `.cs`
// scope as /client, use its tokens and its components (top bar, wordmark, buttons,
// cards, posters), and add only what a public page needs (site.css: hero, sections,
// big type). Paper for what you read, ink for what you watch, orange only where it
// means something.
import "@/app/client/client.css"
import "./site.css"

import Link from "next/link"
import { Wordmark } from "@/app/client/ui"
import { draftsAllowed } from "@/lib/faq"
import { barlow, lobster } from "./fonts"
import { LOGO_SCRIPT, LogoOptionsMark, LogoSwitch, StackedLogo, logoCss } from "./LogoOptions"

const NAV = [
  { key: "work", href: "/work", label: "Work" },
  { key: "make", href: "/#what-we-make", label: "What we make" },
  { key: "contact", href: "/#contact", label: "Contact" },
] as const

type NavKey = (typeof NAV)[number]["key"]

export function SiteFrame({
  children,
  current,
  right,
  footer = "full",
  bare = false,
}: {
  children: React.ReactNode
  /** which nav item is the current page */
  current?: NavKey
  /** replaces the top bar's right side (default: Log in) */
  right?: React.ReactNode
  /** "silo" = the unlisted sales pages: home, work and contact only */
  footer?: "full" | "silo"
  /** no section nav (the silo pages stay single-purpose) */
  bare?: boolean
}) {
  // STAGING ONLY (Sam 10/8 ~14:55, "show me the proposed … logo on the website"): every header-logo option, one at a
  // time (?logo=…, default d83), his stacked logo in the footer, and a toggle. The live site keeps today's Wordmark:
  // drafts are allowed only where the build knows it's staging or `next dev` (fails closed).
  const logoOptions = draftsAllowed()
  return (
    <div className={`cs site ${barlow.variable} ${lobster.variable}`}>
      {logoOptions ? (
        <>
          <script dangerouslySetInnerHTML={{ __html: LOGO_SCRIPT }} />
          <style dangerouslySetInnerHTML={{ __html: logoCss() }} />
        </>
      ) : null}
      <a className="site-skip" href="#main">Skip to content</a>
      <header className="cs-top site-top">
        <div className="cs-top-in">
          <Link href="/" aria-label="Oliver Street Creative, home">
            {logoOptions ? <LogoOptionsMark /> : <Wordmark />}
          </Link>
          {bare ? null : (
            <nav className="cs-nav" aria-label="Main">
              {NAV.map((n) => (
                <Link key={n.key} href={n.href} aria-current={current === n.key ? "page" : undefined}>
                  {n.label}
                </Link>
              ))}
            </nav>
          )}
          <div className="cs-top-r">
            {right ?? (
              // /client, not /login: a signed-in client lands straight in their account;
              // anyone else is sent to /login by middleware, and after the magic link
              // the verify route sends clients to /client and staff to View as client.
              // (Signed-in crew land on /login's "no client account" note: crew site TBD.)
              <a className="cs-chip-btn site-login" href="/client">
                <span>Log in</span>
              </a>
            )}
          </div>
        </div>
      </header>
      <main id="main">{children}</main>
      <SiteFoot variant={footer} stacked={logoOptions} />
      {logoOptions ? <LogoSwitch /> : null}
    </div>
  )
}

function SiteFoot({ variant, stacked }: { variant: "full" | "silo"; stacked: boolean }) {
  return (
    <footer className="site-foot">
      <div className="site-in site-foot-in">
        {/* staging: Sam's real logo, the block, in every header option (the comparison page's footer) */}
        {stacked ? <StackedLogo block className="site-foot-logo" /> : <Wordmark />}
        <p className="site-foot-tag">Stories that move hearts, open minds, and build trust.</p>
        <nav className="site-foot-nav" aria-label="Footer">
          {variant === "silo" ? <Link href="/">Home</Link> : null}
          <Link href="/work">Work</Link>
          <Link href="/#contact">Contact</Link>
          {variant === "full" ? <a href="/client">Log in</a> : null}
        </nav>
        <p className="site-foot-small">© {new Date().getFullYear()} Oliver Street Creative · Covington, KY</p>
      </div>
    </footer>
  )
}

/** A section heading block: small eyebrow, big line, optional lede. */
export function SectionHead({
  eyebrow,
  title,
  lede,
  as: H = "h2",
  center = false,
}: {
  eyebrow?: React.ReactNode
  title: React.ReactNode
  lede?: React.ReactNode
  as?: "h1" | "h2"
  center?: boolean
}) {
  return (
    <div className={`site-head${center ? " center" : ""}`}>
      {eyebrow ? <div className="cs-eyebrow site-eyebrow">{eyebrow}</div> : null}
      <H className="site-h2">{title}</H>
      {lede ? <p className="site-lede">{lede}</p> : null}
    </div>
  )
}
