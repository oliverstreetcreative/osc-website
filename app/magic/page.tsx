// The sign-in link's page (SPEC §27 P0 v2): NOTHING happens on load. One button; its tap is a plain form POST (works
// without JavaScript) that signs in only the browser that asked for the link. A mail scanner that opens the page,
// runs its scripts, even submits the form, holds no device cookie, so it spends nothing and gets nothing. The page
// never looks the token up: a GET reveals nothing about it.
import type { Metadata, Viewport } from "next"

export const metadata: Metadata = { title: "Finish signing in · Oliver Street Creative", robots: { index: false, follow: false } }
export const viewport: Viewport = { themeColor: "#141412", width: "device-width", initialScale: 1 }
export const dynamic = "force-dynamic"

export default function MagicPage({ searchParams }: { searchParams: { token?: string } }) {
  const token = typeof searchParams.token === "string" && /^[0-9a-f]{64}$/.test(searchParams.token) ? searchParams.token : ""
  return (
    <div className="cs-login">
      <div className="cs-login-box">
        <span className="cs-mark" aria-label="Oliver Street Creative" style={{ display: "flex", justifyContent: "center" }}>
          <b>Oliver Street</b>
          <i>Creative</i>
        </span>
        {token ? (
          <>
            <h1>Finish signing in.</h1>
            <p>Tap the button to sign in on this device.</p>
            <form method="post" action="/api/auth/verify">
              <input type="hidden" name="token" value={token} />
              <button type="submit" className="cs-btn light">Sign in</button>
            </form>
            <p className="cs-login-foot">
              On another phone or computer than the one you asked from? <a href="/login?code=1" style={{ textDecoration: "underline" }}>Type the code from the email</a> instead.
            </p>
          </>
        ) : (
          <>
            <h1>That link doesn&rsquo;t look right.</h1>
            <p>
              <a href="/login" style={{ textDecoration: "underline" }}>Ask for a new one</a>, or type the code from your email.
            </p>
          </>
        )}
      </div>
    </div>
  )
}
