// The proposal mini-site: what a /for/<slug> page becomes when its data carries
// a `proposal`. Server component, inline styles, same dark canvas as the pull
// page. Copy comes from Dropbox JSON — nothing here is client input, so the
// small "**Lead.** rest" bolding is rendered from our own strings.

import type { ForProposal } from "@/lib/for-pages"
import type { WorkVideo } from "@/lib/work-videos"
import { muxEmbedSrc } from "@/lib/work-videos"

const ORANGE = "#E07830"
const DIM = "rgba(255,255,255,0.62)"
const QUIET = "rgba(255,255,255,0.45)"
const RULE = "rgba(255,255,255,0.12)"
const serif = "'EB Garamond', Georgia, serif"

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: "12px",
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: "0.18em",
        color: QUIET,
        marginBottom: "18px",
      }}
    >
      {children}
    </div>
  )
}

function Section({ children, id }: { children: React.ReactNode; id?: string }) {
  return (
    <section
      id={id}
      style={{
        borderTop: `1px solid ${RULE}`,
        padding: "clamp(40px, 6vw, 72px) 4px",
      }}
    >
      {children}
    </section>
  )
}

function H2({ children }: { children: React.ReactNode }) {
  return (
    <h2
      style={{
        fontSize: "clamp(24px, 3.4vw, 36px)",
        fontWeight: 900,
        letterSpacing: "-0.02em",
        lineHeight: 1.1,
        margin: "0 0 24px",
      }}
    >
      {children}
    </h2>
  )
}

/** "**Lead.** rest of the sentence" -> bold lead + dim rest. Our own copy only. */
function Lead({ text }: { text: string }) {
  const m = text.match(/^\*\*([^*]+)\*\*\s*([\s\S]*)$/)
  if (!m) return <span>{text}</span>
  return (
    <span>
      <strong style={{ color: "white", fontWeight: 700 }}>{m[1]}</strong> {m[2]}
    </span>
  )
}

function Para({ children }: { children: React.ReactNode }) {
  return (
    <p
      style={{
        fontSize: "clamp(17px, 1.6vw, 19px)",
        lineHeight: 1.65,
        color: DIM,
        maxWidth: "720px",
        margin: "0 0 18px",
      }}
    >
      {children}
    </p>
  )
}

function Button({
  href,
  children,
  primary,
}: {
  href: string
  children: React.ReactNode
  primary?: boolean
}) {
  return (
    <a
      href={href}
      style={{
        display: "inline-block",
        padding: primary ? "16px 36px" : "14px 32px",
        backgroundColor: primary ? ORANGE : "transparent",
        border: `2px solid ${ORANGE}`,
        color: primary ? "#141412" : ORANGE,
        fontSize: "13px",
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: "0.08em",
        textDecoration: "none",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </a>
  )
}

export function ProposalHero({
  proposal,
  prospect,
  logo,
}: {
  proposal: ForProposal
  prospect: string
  logo: React.ReactNode
}) {
  return (
    <div style={{ padding: "16px 4px 24px" }}>
      <Eyebrow>A proposal for</Eyebrow>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.5em",
          flexWrap: "wrap",
          marginBottom: "40px",
        }}
      >
        {logo}
      </div>
      <h1
        style={{
          fontSize: "clamp(34px, 6vw, 68px)",
          fontWeight: 900,
          letterSpacing: "-0.03em",
          lineHeight: 1.02,
          margin: "0 0 24px",
          maxWidth: "900px",
        }}
      >
        {proposal.headline}
      </h1>
      {proposal.hook && (
        <p
          style={{
            fontFamily: serif,
            fontStyle: "italic",
            fontSize: "clamp(22px, 2.6vw, 30px)",
            lineHeight: 1.35,
            color: ORANGE,
            maxWidth: "760px",
            margin: "0 0 28px",
          }}
        >
          {proposal.hook}
        </p>
      )}
      <div style={{ fontSize: "13px", color: QUIET, letterSpacing: "0.04em" }}>
        {[proposal.preparedFor, proposal.date].filter(Boolean).join("  ·  ")}
      </div>
      <span style={{ display: "none" }}>{prospect}</span>
    </div>
  )
}

export function ProposalBody({
  proposal,
  videos,
}: {
  proposal: ForProposal
  videos: WorkVideo[]
}) {
  const inv = proposal.investment
  const cta = proposal.cta ?? {}
  const yesHref = cta.acceptUrl ?? cta.yesUrl
  const yesLabel = cta.acceptUrl ? "Accept this proposal" : cta.yesLabel ?? "Let's do it"

  return (
    <>
      {/* The pitch */}
      <Section>
        <Eyebrow>The idea</Eyebrow>
        {proposal.overview.map((p, i) => (
          <Para key={i}>{p}</Para>
        ))}
      </Section>

      {/* Sections: approach etc. */}
      {proposal.sections?.map((sec) => (
        <Section key={sec.title}>
          <H2>{sec.title}</H2>
          {sec.lead && <Para>{sec.lead}</Para>}
          {sec.bullets && (
            <ul
              style={{
                listStyle: "none",
                padding: 0,
                margin: 0,
                display: "grid",
                gap: "18px",
                maxWidth: "760px",
              }}
            >
              {sec.bullets.map((b, i) => (
                <li
                  key={i}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "14px 1fr",
                    gap: "14px",
                    fontSize: "17px",
                    lineHeight: 1.6,
                    color: DIM,
                  }}
                >
                  <span
                    style={{
                      width: "8px",
                      height: "8px",
                      marginTop: "10px",
                      backgroundColor: ORANGE,
                      display: "inline-block",
                    }}
                  />
                  <Lead text={b} />
                </li>
              ))}
            </ul>
          )}
        </Section>
      ))}

      {/* Selected work, chosen for this prospect */}
      {videos.length > 0 && (
        <Section>
          <Eyebrow>Selected work</Eyebrow>
          <H2>{proposal.workTitle ?? "Work like what you're after"}</H2>
          {proposal.workIntro && <Para>{proposal.workIntro}</Para>}
          <div style={{ marginTop: "32px" }}>
            {videos.map((video) => (
              <div key={video.slug} style={{ marginBottom: "56px" }}>
                <div
                  style={{
                    width: "100%",
                    aspectRatio: "16/9",
                    backgroundColor: "black",
                    overflow: "hidden",
                  }}
                >
                  <iframe
                    src={muxEmbedSrc(video)}
                    title={video.title}
                    style={{ width: "100%", height: "100%", border: 0 }}
                    allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture;"
                    allowFullScreen
                  />
                </div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "14px",
                    padding: "20px 4px 0",
                    flexWrap: "wrap",
                  }}
                >
                  <img
                    src={video.clientLogo}
                    alt={video.clientName}
                    style={{
                      height: "30px",
                      width: "auto",
                      filter: video.isLightLogo ? "none" : "brightness(0) invert(1)",
                    }}
                  />
                  <div>
                    <div style={{ fontSize: "clamp(18px, 2.4vw, 24px)", fontWeight: 800, letterSpacing: "-0.01em" }}>
                      {video.title}
                    </div>
                    <div style={{ fontSize: "14px", color: DIM }}>{video.client}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Deliverables */}
      {proposal.deliverables && (
        <Section>
          <H2>What you get</H2>
          <div style={{ display: "grid", gap: "0", maxWidth: "860px" }}>
            {proposal.deliverables.map((d, i) => (
              <div
                key={i}
                style={{
                  display: "grid",
                  gridTemplateColumns: "minmax(0, 1.6fr) minmax(0, 1fr)",
                  gap: "24px",
                  padding: "18px 0",
                  borderTop: i === 0 ? "none" : `1px solid ${RULE}`,
                }}
              >
                <div>
                  <div style={{ fontSize: "18px", fontWeight: 700 }}>{d.item}</div>
                  {d.detail && (
                    <div style={{ fontSize: "15px", color: DIM, marginTop: "4px", lineHeight: 1.5 }}>{d.detail}</div>
                  )}
                </div>
                <div style={{ fontSize: "15px", color: DIM, lineHeight: 1.5, alignSelf: "center" }}>{d.use}</div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Timeline */}
      {proposal.timeline && (
        <Section>
          <H2>How it goes</H2>
          <div style={{ display: "grid", gap: "20px", maxWidth: "760px" }}>
            {proposal.timeline.map((t, i) => (
              <div key={i} style={{ display: "grid", gridTemplateColumns: "minmax(120px, 180px) 1fr", gap: "20px" }}>
                <div style={{ fontSize: "13px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: ORANGE, paddingTop: "4px" }}>
                  {t.when}
                </div>
                <div style={{ fontSize: "17px", lineHeight: 1.6, color: DIM }}>{t.what}</div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Investment */}
      <Section id="investment">
        <Eyebrow>Investment</Eyebrow>
        {inv.intro && <Para>{inv.intro}</Para>}
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "space-between",
            gap: "24px",
            flexWrap: "wrap",
            borderTop: `3px solid ${ORANGE}`,
            paddingTop: "28px",
            marginTop: "24px",
            maxWidth: "860px",
          }}
        >
          <div>
            <div style={{ fontSize: "12px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.15em", color: QUIET }}>
              Project investment
            </div>
            {(inv.standardRate || inv.label) && (
              <div style={{ fontSize: "15px", color: DIM, marginTop: "8px" }}>
                {inv.standardRate && (
                  <>
                    Standard rate{" "}
                    <span style={{ textDecoration: "line-through", color: QUIET }}>{inv.standardRate}</span>
                  </>
                )}
                {inv.standardRate && inv.label && "  ·  "}
                {inv.label}
              </div>
            )}
          </div>
          <div style={{ fontSize: "clamp(44px, 7vw, 72px)", fontWeight: 900, letterSpacing: "-0.03em", lineHeight: 1 }}>
            {inv.amount}
          </div>
        </div>
        {inv.note && (
          <p style={{ fontSize: "14px", color: QUIET, maxWidth: "860px", textAlign: "right", margin: "14px 0 0", lineHeight: 1.5 }}>
            {inv.note}
          </p>
        )}

        {proposal.options && proposal.options.length > 0 && (
          <div style={{ marginTop: "48px", maxWidth: "860px" }}>
            <Eyebrow>Optional</Eyebrow>
            <div style={{ display: "grid", gap: "16px" }}>
              {proposal.options.map((o, i) => (
                <div
                  key={i}
                  style={{
                    border: `1px solid ${RULE}`,
                    borderLeft: `3px solid ${ORANGE}`,
                    padding: "20px 24px",
                    display: "grid",
                    gridTemplateColumns: "1fr auto",
                    gap: "24px",
                    alignItems: "start",
                  }}
                >
                  <div>
                    <div style={{ fontSize: "18px", fontWeight: 700, marginBottom: "6px" }}>{o.title}</div>
                    <div style={{ fontSize: "15px", color: DIM, lineHeight: 1.55 }}>{o.body}</div>
                  </div>
                  <div style={{ fontSize: "22px", fontWeight: 900, letterSpacing: "-0.02em", whiteSpace: "nowrap" }}>{o.price}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </Section>

      {/* CTA */}
      <Section>
        <div style={{ textAlign: "center", maxWidth: "720px", margin: "0 auto" }}>
          <p
            style={{
              fontFamily: serif,
              fontStyle: "italic",
              fontSize: "clamp(24px, 3vw, 34px)",
              lineHeight: 1.3,
              margin: "0 0 32px",
            }}
          >
            Let's make something together.
          </p>
          <div style={{ display: "flex", gap: "14px", justifyContent: "center", flexWrap: "wrap" }}>
            {yesHref && (
              <Button href={yesHref} primary>
                {yesLabel}
              </Button>
            )}
            {cta.callUrl && <Button href={cta.callUrl}>Book a call</Button>}
          </div>
          {cta.changesUrl && (
            <p style={{ fontSize: "15px", color: DIM, marginTop: "28px", lineHeight: 1.6 }}>
              Not quite right?{" "}
              <a href={cta.changesUrl} style={{ color: "white", textDecoration: "underline", textUnderlineOffset: "3px" }}>
                {cta.changesLabel ?? "Tell me what needs to move"}
              </a>
              . Pricing is modular.
            </p>
          )}
          {proposal.validUntil && (
            <p style={{ fontSize: "12px", color: QUIET, marginTop: "20px" }}>This proposal is valid through {proposal.validUntil}.</p>
          )}
        </div>
      </Section>

      {/* Terms */}
      {proposal.terms && (
        <Section>
          <Eyebrow>Terms</Eyebrow>
          <ul style={{ margin: 0, padding: "0 0 0 18px", maxWidth: "760px", display: "grid", gap: "8px" }}>
            {proposal.terms.map((t, i) => (
              <li key={i} style={{ fontSize: "14px", lineHeight: 1.55, color: QUIET }}>
                {t}
              </li>
            ))}
          </ul>
        </Section>
      )}
    </>
  )
}
