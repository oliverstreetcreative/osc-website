// Appearance (SPEC §20 v2): Auto (follow the phone) / Light / Dark, remembered per device in the `cs_theme` cookie.
// The portal's root layouts read it on the server and render data-theme, so the page draws in the right theme with
// no flash. Auto is the absence of the cookie. Shared with our other apps on oliverstreetcreative.com (the hub and
// Review read the same cookie); it is not a credential.
import { cookies } from "next/headers"

export const THEME_COOKIE = "cs_theme"
export type Theme = "auto" | "light" | "dark"

export async function themeFromCookie(): Promise<Theme> {
  const v = (await cookies()).get(THEME_COOKIE)?.value
  return v === "light" || v === "dark" ? v : "auto"
}
