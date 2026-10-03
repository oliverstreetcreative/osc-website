// STAGING-ONLY preview sign-in, so the worker can screenshot real pages and
// Sam can look without a client ever being emailed. Production: 404, always.
// The key lives in Keychain "osc-client-preview-key"; only its sha256 is here.
import { NextRequest, NextResponse } from "next/server"
import { createHash, timingSafeEqual } from "crypto"
import { SignJWT } from "jose"
import { db } from "@/lib/db"
import { IS_STAGING } from "@/lib/site-env"
import { cookieDomainFor, isSecure, publicOrigin } from "@/lib/client/host"
import { VIEW_COOKIE } from "@/lib/client/context"
import { logViewAs, mintViewCookie, VIEW_TTL_SECONDS } from "@/lib/client/view-as"

const KEY_SHA256 = "541190cb348c7ac8454b5ae2eda83deecf9a35d8c72810539c1133fddc9c84ea"

export async function GET(req: NextRequest) {
  if (!IS_STAGING) return new NextResponse(null, { status: 404 })
  const secret = process.env.SESSION_JWT_SECRET
  const key = req.nextUrl.searchParams.get("key") ?? ""
  const got = createHash("sha256").update(key).digest()
  if (!secret || !timingSafeEqual(got, Buffer.from(KEY_SHA256, "hex"))) return new NextResponse(null, { status: 404 })

  const as = (req.nextUrl.searchParams.get("as") ?? "").trim().toLowerCase()
  const person = await db.person.findUnique({ where: { email: as } })
  if (!person || !person.portal_allowed) return new NextResponse("No such person on staging.", { status: 404 })

  const expires = new Date(Date.now() + 12 * 3600_000)
  const jwt = await new SignJWT({ id: person.id, email: person.email, role: person.role, is_staff: person.is_staff, preview: true })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(Math.floor(expires.getTime() / 1000))
    .sign(new TextEncoder().encode(secret))
  const next = req.nextUrl.searchParams.get("next") ?? "/client"
  const frames = req.nextUrl.searchParams.get("frames")
  // Screenshots of both appearances (SPEC §20): &theme=dark|light is stored the portal's own way (localStorage
  // osc.portal.look, the hub's convention) by the frames page before its iframes load; anything else = Auto.
  const themeParam = req.nextUrl.searchParams.get("theme")
  const look = themeParam === "dark" || themeParam === "light" ? themeParam : null
  const res = frames
    ? new NextResponse(framesHtml(frames.split(",").filter((p) => p.startsWith("/client") || p === "/login"), look), {
        headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
      })
    : NextResponse.redirect(`${publicOrigin(req)}${next.startsWith("/") ? next : "/client"}`, 303)
  res.cookies.set("osc_session", jwt, { domain: cookieDomainFor(req), path: "/", httpOnly: true, sameSite: "lax", secure: isSecure(req), expires })
  res.cookies.set("cs_org", "", { path: "/", maxAge: 0 })
  // Staff only: &view=<org-slug> opens "View as client" directly (for screenshots), logged like a real start.
  const view = req.nextUrl.searchParams.get("view")
  const org = view && person.is_staff ? await db.organization.findFirst({ where: { slug: view, hidden: false } }) : null
  if (org) {
    await logViewAs("view_as_start", person, org, req)
    res.cookies.set(VIEW_COOKIE, await mintViewCookie(person.id, org.slug), {
      domain: cookieDomainFor(req), path: "/", httpOnly: true, sameSite: "lax", secure: isSecure(req), maxAge: VIEW_TTL_SECONDS,
    })
  } else {
    res.cookies.set(VIEW_COOKIE, "", { domain: cookieDomainFor(req), path: "/", maxAge: 0 })
  }
  return res
}

export const dynamic = "force-dynamic"

// Screenshot harness: true 390x844 phone screens of each path, scrolled one
// screen at a time (headless Chrome won't lay a window out under 500px wide,
// but an iframe will). Same origin, so the session cookie set above applies.
function framesHtml(paths: string[], look: "dark" | "light" | null) {
  const list = JSON.stringify(paths.map((p) => p.replace(/[<>"']/g, "")))
  const setLook = look
    ? `try{localStorage.setItem("osc.portal.look","${look}")}catch(e){}`
    : `try{localStorage.removeItem("osc.portal.look")}catch(e){}`
  return `<!doctype html><meta charset="utf-8"><title>frames</title>
<style>body{margin:0;background:#3a3a38;display:flex;flex-wrap:wrap;gap:14px;padding:14px;font:12px -apple-system,sans-serif;color:#ddd}
figure{margin:0}iframe{width:390px;height:844px;border:0;background:#fff;display:block;border-radius:6px}figcaption{padding:3px 2px}</style>
<body><script>
${setLook}
const paths=${list};
for (const p of paths) {
  const f=document.createElement('figure'); f.innerHTML='<figcaption>'+p+' · 1</figcaption>';
  const i=document.createElement('iframe'); i.src=p; f.appendChild(i); document.body.appendChild(f);
  i.onload=()=>{ if(f.dataset.done)return; f.dataset.done=1; let last=f; const h=i.contentDocument.documentElement.scrollHeight; const n=Math.min(6,Math.ceil((h-60)/760));
    for(let k=1;k<n;k++){ const g=document.createElement('figure'); g.innerHTML='<figcaption>'+p+' · '+(k+1)+'</figcaption>';
      const j=document.createElement('iframe'); j.src=p; j.onload=()=>j.contentWindow.scrollTo(0,k*760); g.appendChild(j); last.after(g); last=g; }
  };
}
</script>`
}
