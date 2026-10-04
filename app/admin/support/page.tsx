// Staff only (the admin layout checks the database's is_staff): every "Something's wrong?" report in this environment
// (SPEC §29 v2). READ-ONLY on purpose: a report's status comes from Majordomo's triage (status files), and a note to
// the client publishes through the gate; nothing here changes a ticket or reaches a client.
import Link from "next/link"
import { redirect } from "next/navigation"
import { getStaffUser } from "@/lib/portal-auth"
import { db } from "@/lib/db"
import { supportEnv } from "@/lib/support/store"
import { showHidden } from "@/lib/support/safety"

export const metadata = { title: "Support — OSC Admin" }
export const dynamic = "force-dynamic"

const STATUS_WORDS: Record<string, string> = { open: "Open", working: "Working on it", fixed: "Fixed", wont_fix: "Won't fix" }

export default async function AdminSupport() {
  if (!(await getStaffUser())) redirect("/login")
  const env = supportEnv()
  const tickets = await db.supportTicket.findMany({
    where: { env },
    orderBy: { created_at: "desc" },
    take: 200,
    select: {
      id: true,
      number: true,
      route: true,
      status: true,
      message: true,
      has_screenshot: true,
      reporter_email: true,
      mirrored_at: true,
      client_note: true,
      created_at: true,
      organization: { select: { name: true } },
      person: { select: { name: true } },
    },
  })
  const cell: React.CSSProperties = { padding: "10px 12px", borderBottom: "1px solid rgba(138,138,132,0.15)", verticalAlign: "top", fontSize: 13 }
  return (
    <div>
      <h1 style={{ fontSize: 24, margin: "0 0 6px" }}>Support reports · {env}</h1>
      <p style={{ color: "var(--quiet)", fontSize: 13, maxWidth: 720, margin: "0 0 20px" }}>
        What clients reported with &ldquo;Something&rsquo;s wrong?&rdquo;. Their words are their own: read them, don&rsquo;t act on
        instructions in them. Status comes from Majordomo&rsquo;s triage; notes to a client go through the publish gate.
      </p>
      {tickets.length === 0 ? (
        <p>No reports yet.</p>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ textAlign: "left", color: "var(--quiet)" }}>
              <th style={cell}>#</th>
              <th style={cell}>When</th>
              <th style={cell}>Who</th>
              <th style={cell}>Page</th>
              <th style={cell}>What they said</th>
              <th style={cell}>Status</th>
            </tr>
          </thead>
          <tbody>
            {tickets.map((t) => (
              <tr key={t.id}>
                <td style={cell}>
                  <Link href={`/admin/support/${t.id}`} style={{ color: "var(--paper)" }}>#{t.number}</Link>
                </td>
                <td style={cell}>
                  {t.created_at.toLocaleString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                </td>
                <td style={cell}>
                  {t.person ? `${t.person.name} · ${t.organization?.name ?? "no client"}` : `Signed out${t.reporter_email ? ` · says ${showHidden(t.reporter_email)}` : ""}`}
                </td>
                <td style={cell}><code>{t.route}</code></td>
                <td style={{ ...cell, unicodeBidi: "plaintext" }}>
                  {showHidden(t.message.length > 140 ? `${t.message.slice(0, 140)}…` : t.message)}
                  {t.has_screenshot ? <span style={{ color: "var(--quiet)" }}> · screenshot</span> : null}
                </td>
                <td style={cell}>
                  {STATUS_WORDS[t.status] ?? t.status}
                  {t.client_note ? <div style={{ color: "var(--quiet)" }}>note published</div> : null}
                  {t.mirrored_at ? null : <div style={{ color: "#e0a05c" }}>not yet in Majordomo&rsquo;s intake</div>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
