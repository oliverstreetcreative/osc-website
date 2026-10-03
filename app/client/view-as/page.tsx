import { notFound, redirect } from "next/navigation"
import { Eye, ChevronRight } from "lucide-react"
import { getPortalUser } from "@/lib/portal-auth"
import { db } from "@/lib/db"
import { viewAsOrgSlug } from "@/lib/client/context"
import { day } from "@/lib/client/format"
import { Wordmark } from "@/app/client/ui"

export const metadata = { title: "View as client" }
export const dynamic = "force-dynamic"

// OSC staff only. Pick a client and see exactly their site, read-only.
export default async function ViewAsPicker() {
  const user = await getPortalUser()
  if (!user) redirect("/login")
  if (!user.is_staff) notFound()
  const current = await viewAsOrgSlug(user.id)

  const orgs = await db.organization.findMany({
    where: { hidden: false },
    orderBy: { name: "asc" },
    select: {
      slug: true,
      name: true,
      short_name: true,
      logo_path: true,
      _count: { select: { projects: { where: { hidden: false } }, memberships: { where: { hidden: false } } } },
      invoices: { where: { hidden: false, status: "open" }, select: { id: true } },
    },
  })
  const live = orgs.filter((o) => !o.slug.endsWith("--preview"))
  const previews = orgs.filter((o) => o.slug.endsWith("--preview"))
  const recent = await db.portalEvent.findMany({
    where: { event_type: { in: ["view_as_start", "view_as_exit"] } },
    orderBy: { occurred_at: "desc" },
    take: 5,
    select: { id: true, summary: true, occurred_at: true },
  })
  const first = (user.name ?? "").split(" ")[0]

  return (
    <>
      <header className="cs-top">
        <div className="cs-top-in">
          <Wordmark />
          <div className="cs-top-r">
            <form action="/client/signout" method="post">
              <button className="cs-chip-btn" style={{ background: "none" }}>Sign out</button>
            </form>
          </div>
        </div>
      </header>
      <main className="cs-main">
        <p className="cs-eyebrow">OSC staff</p>
        <h1 className="cs-hello">Hi, {first}.</h1>
        <p className="cs-lede">See any client&rsquo;s site exactly as they do. Read-only.</p>

        <section className="cs-section" style={{ marginTop: 22 }}>
          <h2 className="cs-h2"><span>View as client</span></h2>
          {live.length ? (
            <div className="cs-rows">
              {live.map((o) => (
                <form key={o.slug} action="/client/view-as/start" method="post" style={{ display: "block" }}>
                  <input type="hidden" name="slug" value={o.slug} />
                  <button className="cs-row cs-pick" aria-label={`View as ${o.name}`}>
                    <span className="cs-ico">
                      {o.logo_path?.startsWith("/client-logos/") ? <img src={o.logo_path} alt="" className="cs-pick-logo" /> : <Eye />}
                    </span>
                    <span className="cs-row-main">
                      <strong>{o.name}</strong>
                      <small>
                        {o._count.projects} project{o._count.projects === 1 ? "" : "s"} · {o._count.memberships} people
                        {o.invoices.length ? ` · ${o.invoices.length} open invoice${o.invoices.length === 1 ? "" : "s"}` : ""}
                        {current === o.slug ? " · viewing now" : ""}
                      </small>
                    </span>
                    <ChevronRight size={18} color="var(--muted)" />
                  </button>
                </form>
              ))}
            </div>
          ) : (
            <div className="cs-card cs-empty"><b>No clients yet.</b></div>
          )}
        </section>

        {previews.length ? (
          <section className="cs-section">
            <h2 className="cs-h2"><span>Previews · not live yet</span></h2>
            <div className="cs-rows">
              {previews.map((o) => (
                <form key={o.slug} action="/client/view-as/start" method="post" style={{ display: "block" }}>
                  <input type="hidden" name="slug" value={o.slug} />
                  <button className="cs-row cs-pick" aria-label={`Preview ${o.name}`}>
                    <span className="cs-ico"><Eye /></span>
                    <span className="cs-row-main">
                      <strong>{o.name}</strong>
                      <small>What goes live if you tap Publish{current === o.slug ? " · viewing now" : ""}</small>
                    </span>
                    <ChevronRight size={18} color="var(--muted)" />
                  </button>
                </form>
              ))}
            </div>
          </section>
        ) : null}

        {recent.length ? (
          <section className="cs-section">
            <h2 className="cs-h2"><span>Recent views (logged)</span></h2>
            <div className="cs-rows">
              {recent.map((e) => (
                <div key={e.id} className="cs-row" style={{ minHeight: 52 }}>
                  <span className="cs-row-main">
                    <strong style={{ fontWeight: 500, fontSize: 14 }}>{e.summary}</strong>
                    <small>{day(e.occurred_at, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/New_York" })}</small>
                  </span>
                </div>
              ))}
            </div>
          </section>
        ) : null}
      </main>
    </>
  )
}
