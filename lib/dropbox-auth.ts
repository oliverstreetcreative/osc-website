/**
 * Dropbox OAuth access-token helper.
 *
 * Production Railway uses long-lived refresh-token credentials:
 *   DROPBOX_APP_KEY
 *   DROPBOX_APP_SECRET
 *   DROPBOX_REFRESH_TOKEN
 *
 * These are exchanged for short-lived (4h) access tokens via the Dropbox
 * OAuth endpoint and cached in memory.
 *
 * For quick local testing you can also set DROPBOX_ACCESS_TOKEN directly
 * and the helper will use it as-is, bypassing the refresh flow.
 */

type CacheEntry = { token: string; expires: number }
let cache: CacheEntry | null = null

// Refresh ~15 minutes before the 4-hour access token actually expires,
// so a request in flight never hits an expired token.
const REFRESH_SKEW_MS = 15 * 60 * 1000

/**
 * Returns a usable Dropbox access token, refreshing via the OAuth endpoint
 * when necessary. Returns null if credentials are missing — callers should
 * fall back to the local-filesystem path or return an error.
 */
export async function getDropboxAccessToken(): Promise<string | null> {
  // Dev shortcut: if a static access token is provided, use it.
  const staticToken = process.env.DROPBOX_ACCESS_TOKEN?.trim()
  if (staticToken) return staticToken

  const appKey = process.env.DROPBOX_APP_KEY?.trim()
  const appSecret = process.env.DROPBOX_APP_SECRET?.trim()
  const refreshToken = process.env.DROPBOX_REFRESH_TOKEN?.trim()
  if (!appKey || !appSecret || !refreshToken) return null

  const now = Date.now()
  if (cache && cache.expires > now) return cache.token

  try {
    const params = new URLSearchParams()
    params.set("grant_type", "refresh_token")
    params.set("refresh_token", refreshToken)
    params.set("client_id", appKey)
    params.set("client_secret", appSecret)

    const res = await fetch("https://api.dropbox.com/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    })
    if (!res.ok) {
      console.error("dropbox-auth: refresh failed", res.status, await res.text())
      return null
    }
    const body = (await res.json()) as {
      access_token: string
      expires_in: number
    }
    const expiresMs = (body.expires_in || 14400) * 1000
    cache = {
      token: body.access_token,
      expires: now + expiresMs - REFRESH_SKEW_MS,
    }
    return cache.token
  } catch (err) {
    console.error("dropbox-auth: refresh exception", err)
    return null
  }
}

export function clearDropboxTokenCache(): void {
  cache = null
}
