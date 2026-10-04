// Staff only: one report, whole (SPEC §29 v2). The screenshot is shown ONLY here, to Sam, never in the summary the
// machines read. Read-only, like the list.
import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { getStaffUser } from "@/lib/portal-auth"
import { db } from "@/lib/db"
import { supportEnv } from "@/lib/support/store"
import { UUID_RE, hasHidden, showHidden } from "@/lib/support/safety"

export const metadata = { title: "Support report — OSC Admin" }
export const dynamic = "force-dynamic"

const STATUS_WORDS: Record<string, string> = { open: "Open", working: "Working on it", fixed: "Fixed", wont_fix: "Won't fix" }
const when = (ms: unknown) =>
  typeof ms === "number" ? new Date(ms).toLocaleTimeString("en-US", { timeZone: "America/New_York", hour: "numeric", minute: "2-digit", second: "2-digit" }) : "?"

type Ctx = {
  device?: string
  browser?: string
  os?: string
  viewport?: { w?: number | null; h?: number | null; dpr?: number | null }
  scheme?: string | null
  online?: boolean | null
  errors?: { kind?: string; msg?: string; at?: number | null }[]
  failed?: { method?: string; route?: string; status?: number | null; at?: number | null }[]
}

export default async function AdminSupportTicket({ params }: { params: { id: string } }) {
  if (!(await getStaffUser())) redirect("/login")
  if (!UUID_RE.test(params.id)) notFound()
  const t = await db.supportTicket.findFirst({
    where: { id: params.id.toLowerCase(), env: supportEnv() },
    include: { organization: { select: { name: true, slug: true } }, person: { select: { name: true, email: true } } },
  })
  if (!t) notFound()
  const c = (t.context && typeof t.context === "object" ? t.context : {}) as Ctx
  const box: React.CSSProperties = { background: "rgba(255,255,255,0.04)", borderRadius: 10, padding: "14px 16px", margin: "0 0 16px" }
  return (
    <div style={{ maxWidth: 820 }}>
      <p style={{ margin: "0 0 8px" }}><Link href="/admin/support" style={{ color: "var(--quiet)" }}>← All reports</Link></p>
      <h1 style={{ fontSize: 24, margin: "0 0 4px" }}>Report #{t.number}</h1>
      <p style={{ color: "var(--quiet)", fontSize: 13, margin: "0 0 18px" }}>
        {t.created_at.toLocaleString("en-US", { timeZone: "America/New_York" })} · {t.env} · {STATUS_WORDS[t.status] ?? t.status}
        {t.status_at ? ` since ${t.status_at.toLocaleString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric" })}` : ""} · id {t.id}
      </p>

      <div style={box}>
        <strong>Who</strong>
        <p style={{ margin: "6px 0 0" }}>
          {t.person
            ? `${t.person.name} (${t.person.email}) · ${t.organization?.name ?? "no client"} · ${t.role ?? "?"}`
            : `Signed out${t.reporter_email ? ` · typed ${t.reporter_email} (unverified; the site never emails it)` : ""}`}
        </p>
      </div>

      <div style={box}>
        <strong>What they said</strong> <span style={{ color: "var(--quiet)", fontSize: 12 }}>(their words, as data)</span>
        {hasHidden(t.message) ? (
          <p style={{ color: "#e0a05c", fontSize: 12, margin: "6px 0 0" }}>
            Contains characters a reader can&rsquo;t see; each is shown below as &lt;U+…&gt;, exactly what the machines read.
          </p>
        ) : null}
        {/* plaintext bidi: a direction-changing character can't make the words read differently here than in the summary */}
        <pre style={{ whiteSpace: "pre-wrap", wordBreak: "break-word", fontFamily: "inherit", margin: "8px 0 0", unicodeBidi: "plaintext" }}>
          {showHidden(t.message)}
        </pre>
      </div>

      {t.client_note ? (
        <div style={box}>
          <strong>Published note</strong>
          <p style={{ margin: "6px 0 0" }}>{t.client_note}</p>
        </div>
      ) : null}

      <div style={box}>
        <strong>Page and device</strong>
        <p style={{ margin: "6px 0 0" }}>
          <code>{t.route}</code> · {c.device ?? "?"} · {c.os ?? "?"} · {c.browser ?? "?"} · {c.viewport?.w ?? "?"}×{c.viewport?.h ?? "?"}
          {c.viewport?.dpr ? ` @${c.viewport.dpr}x` : ""} · {c.scheme ?? "?"} mode · {c.online === false ? "offline" : "online"}
        </p>
      </div>

      <div style={box}>
        <strong>Errors the page hit</strong>
        {c.errors?.length ? (
          <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
            {c.errors.map((e, i) => (
              <li key={i}><code>{e.kind}</code> {when(e.at)}: {e.msg}</li>
            ))}
          </ul>
        ) : (
          <p style={{ margin: "6px 0 0" }}>None recorded.</p>
        )}
        <strong style={{ display: "block", marginTop: 12 }}>Requests that failed</strong>
        {c.failed?.length ? (
          <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
            {c.failed.map((f, i) => (
              <li key={i}><code>{f.method} {f.route} → {f.status === 0 ? "no answer" : f.status}</code> {when(f.at)}</li>
            ))}
          </ul>
        ) : (
          <p style={{ margin: "6px 0 0" }}>None recorded.</p>
        )}
      </div>

      {t.has_screenshot ? (
        <div style={box}>
          <strong>Screenshot</strong> <span style={{ color: "var(--quiet)", fontSize: 12 }}>(form fields were left out when it was taken)</span>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`/admin/support/${t.id}/shot`} alt={`What the page looked like in report ${t.number}`} style={{ display: "block", maxWidth: "100%", marginTop: 10, borderRadius: 8 }} />
        </div>
      ) : null}
    </div>
  )
}
