// The one sign-in's registry of relying parties (client-website SPEC §27 P1 v2 #9): per environment, exact URIs only.
// Production never lists staging URIs, and the reverse. Pure (the env is passed in), so it's unit-tested.
// The paths are fixed by the contract (contracts/osc-signin-contract-v1.md §1).

export type IdpEnv = "production" | "staging" | "local"

export type IdpClient = {
  client_id: string
  surface: "sign" | "test"
  /** The env var holding this client's secret (client_secret_basic, at least 32 random bytes). */
  secret_env: string
  redirect_uris: string[]
  post_logout_redirect_uris: string[]
  backchannel_logout_uri: string
  initiate_login_uri: string
}

export const RP_PATHS = {
  callback: "/auth/oidc/callback",
  backchannel: "/auth/oidc/backchannel-logout",
  initiate: "/auth/oidc/login",
} as const

const rp = (client_id: string, surface: IdpClient["surface"], secret_env: string, origin: string): IdpClient => ({
  client_id,
  surface,
  secret_env,
  redirect_uris: [`${origin}${RP_PATHS.callback}`],
  post_logout_redirect_uris: [`${origin}/`],
  backchannel_logout_uri: `${origin}${RP_PATHS.backchannel}`,
  initiate_login_uri: `${origin}${RP_PATHS.initiate}`,
})

/** The clients for one environment. Staging's Sign Here origin comes from env (its Railway host); a bad value drops
 *  the client rather than registering a wrong URI. The `test` client exists only off production. */
export function registry(env: IdpEnv, getEnv: (name: string) => string | undefined): IdpClient[] {
  const out: IdpClient[] = []
  if (env === "production") {
    out.push(rp("sign", "sign", "IDP_CLIENT_SIGN_SECRET", "https://sign.oliverstreetcreative.com"))
    return out
  }
  const signOrigin = (getEnv("IDP_SIGN_ORIGIN") ?? "").trim().replace(/\/+$/, "")
  if (/^https:\/\/[a-z0-9.-]+$/i.test(signOrigin) && !signOrigin.endsWith("://sign.oliverstreetcreative.com")) {
    out.push(rp("sign", "sign", "IDP_CLIENT_SIGN_SECRET", signOrigin))
  }
  // The rehearsal relying party (scripts/rehearse_idp.py) catches its code on a loopback port.
  out.push({ ...rp("test", "test", "IDP_CLIENT_TEST_SECRET", "http://127.0.0.1:8765"), backchannel_logout_uri: "http://127.0.0.1:8765/backchannel" })
  return out
}

/** Exact matching only: no prefixes, no case-folding, a trailing slash is a different URI. */
export const exactlyRegistered = (allowed: string[], uri: unknown) => typeof uri === "string" && allowed.includes(uri)
