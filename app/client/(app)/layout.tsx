import { requireClientContext } from "@/lib/client/context"
import { visibleScriptsWhere } from "@/lib/client/data"
import { db } from "@/lib/db"
import { ImpersonationBanner } from "@/components/ImpersonationBanner"
import { Wordmark } from "@/app/client/ui"
import { Nav, Tabs } from "@/app/client/nav"
import { ThemeSwitch } from "@/app/client/theme-switch"

export default async function ClientShell({ children }: { children: React.ReactNode }) {
  const ctx = await requireClientContext()
  const scripts = (await db.script.count({ where: visibleScriptsWhere(ctx.org.id, ctx.viewing ? undefined : ctx.user.id) })) > 0
  const initials = (ctx.user.first_name ?? ctx.user.name ?? "?").trim().slice(0, 1).toUpperCase()
  const showOrgs = !ctx.viewing && ctx.orgs.length > 1

  return (
    <>
      <ImpersonationBanner />
      <div className="cs-sticky">
      {ctx.viewing?.demo ? (
        <div className="cs-viewing demo" role="status">
          <span>Demo · sample data</span>
        </div>
      ) : ctx.viewing ? (
        <div className="cs-viewing" role="status">
          <span>
            {ctx.viewing.preview ? (
              <>Preview of <b>{ctx.viewing.orgName}</b> · not live yet</>
            ) : (
              <>Viewing as <b>{ctx.viewing.orgName}</b> · read-only</>
            )}
          </span>
          <span className="cs-viewing-act">
            {ctx.viewing.legacy ? (
              // The older admin impersonation ends at its own route.
              <form action="/api/admin/impersonate/stop" method="post">
                <button>Exit</button>
              </form>
            ) : (
              <>
                <a href="/client/view-as">Switch</a>
                <form action="/client/view-as/exit" method="post">
                  <button>Exit</button>
                </form>
              </>
            )}
          </span>
        </div>
      ) : null}
      <header className="cs-top">
        <div className="cs-top-in">
          <a href="/client" aria-label="Home"><Wordmark /></a>
          <Nav scripts={scripts} />
          <div className="cs-top-r">
            {showOrgs ? (
              <details className="cs-menu">
                <summary className="cs-chip-btn"><span>{ctx.org.short_name ?? ctx.org.name}</span> ▾</summary>
                <div className="cs-pop">
                  {ctx.orgs.map((o) => (
                    <form key={o.id} action="/client/org" method="post">
                      <input type="hidden" name="slug" value={o.slug} />
                      <button className={o.id === ctx.org.id ? "on" : ""}>{o.name}</button>
                    </form>
                  ))}
                </div>
              </details>
            ) : null}
            <details className="cs-menu">
              <summary className="cs-avatar" aria-label="Account">{initials}</summary>
              <div className="cs-pop">
                <div className="cs-pop-head">
                  <strong>{ctx.user.name}</strong>
                  <small>
                    {ctx.viewing?.demo ? "Demo account" : ctx.viewing ? `OSC staff · viewing ${ctx.viewing.orgName}` : ctx.user.email}
                  </small>
                </div>
                {ctx.viewing?.demo ? null : ctx.viewing?.legacy ? (
                  <form action="/api/admin/impersonate/stop" method="post"><button>Stop viewing</button></form>
                ) : ctx.viewing ? (
                  <>
                    <a href="/client/view-as">View another client</a>
                    <form action="/client/view-as/exit" method="post"><button>Stop viewing</button></form>
                  </>
                ) : (
                  <a href="/client/calendar">Calendar feed</a>
                )}
                <ThemeSwitch />
                <form action="/client/signout" method="post"><button>Sign out</button></form>
              </div>
            </details>
          </div>
        </div>
      </header>
      </div>
      {children}
      <Tabs scripts={scripts} />
    </>
  )
}
