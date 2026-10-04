// "Your reports" (SPEC §29 v2): what someone told us was wrong, and where each one stands. Only their own reports.
// A note shows only once Sam approved it (it's published through the gate, like any client-facing words).
import { requireClientContext } from "@/lib/client/context"
import { db } from "@/lib/db"
import { HelpFooter } from "@/app/client/ui"
import { ReportLink } from "@/app/client/report-sheet"

export const metadata = { title: "Your reports" }

const STATUS: Record<string, string> = { open: "Open", working: "Working on it", fixed: "Fixed", wont_fix: "Won't fix" }
const PAGE: Record<string, string> = {
  "/client": "Home",
  "/client/projects": "Projects",
  "/client/billing": "Billing",
  "/client/documents": "Documents",
  "/client/scripts": "Scripts",
  "/client/support": "Your reports",
  "/client/calendar": "Calendar",
}
const pageName = (route: string) =>
  PAGE[route] ?? (route.includes("/approve/") ? "A cut to approve" : route.includes("/projects/") ? "A project" : route.includes("/scripts/") ? "A script" : route.includes("/proposals/") ? "A proposal" : "A page")

export default async function Support() {
  const ctx = await requireClientContext()
  const reports = ctx.viewing
    ? []
    : await db.supportTicket.findMany({
        where: { person_id: ctx.user.id },
        select: { id: true, number: true, route: true, status: true, status_at: true, client_note: true, created_at: true, message: true },
        orderBy: { created_at: "desc" },
        take: 50,
      })
  const week = Date.now() - 7 * 86400_000
  return (
    <main className="cs-main">
      <p className="cs-eyebrow">{ctx.org.name}</p>
      <h1 className="cs-title" style={{ marginTop: 6 }}>Your reports</h1>
      <section className="cs-section" style={{ marginTop: 16 }}>
        {reports.length ? (
          <div className="cs-rows">
            {reports.map((r) => (
              <div key={r.id} className="cs-row" style={{ alignItems: "flex-start" }}>
                <span className="cs-row-main">
                  <strong>Report #{r.number} · {pageName(r.route)}</strong>
                  <small>
                    {r.created_at.toLocaleDateString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric" })} ·{" "}
                    {r.message.length > 90 ? `${r.message.slice(0, 90)}…` : r.message}
                  </small>
                  {r.client_note ? <small style={{ color: "var(--ink)" }}>{r.client_note}</small> : null}
                  {/* A week with no news (no status change since it was filed or last moved) → a way to nudge. */}
                  {r.status !== "fixed" && r.status !== "wont_fix" && (r.status_at ?? r.created_at).getTime() < week ? (
                    <small>
                      No news for a week · <a href="sms:+18595121419">Text Sam</a>
                    </small>
                  ) : null}
                </span>
                <span className={`cs-status ${r.status === "fixed" ? "paid" : r.status === "open" ? "due" : ""}`}>{STATUS[r.status] ?? "Open"}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="cs-card cs-pad">
            <p>{ctx.viewing ? "Reports are your client's own; staff report as themselves." : "Nothing reported yet."}</p>
          </div>
        )}
        {ctx.viewing ? null : (
          <p style={{ marginTop: 14 }}>
            <ReportLink label="Report something" className="cs-btn" />
          </p>
        )}
      </section>
      <HelpFooter />
    </main>
  )
}
