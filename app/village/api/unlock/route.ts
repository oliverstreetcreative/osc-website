import { NextRequest, NextResponse } from "next/server"
import {
  VILLAGE_COOKIE_NAME,
  checkPassword,
  issueVillageCookie,
  villageCookieMaxAge,
} from "@/app/village/lib"

export const runtime = "nodejs"

export async function POST(req: NextRequest) {
  let password: string | undefined
  try {
    const body = await req.json()
    password = typeof body?.password === "string" ? body.password : undefined
  } catch {
    // fall through — password stays undefined
  }

  if (!password || !(await checkPassword(password))) {
    return NextResponse.json({ ok: false }, { status: 401 })
  }

  const token = await issueVillageCookie()
  const res = NextResponse.json({ ok: true })
  res.cookies.set(VILLAGE_COOKIE_NAME, token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: villageCookieMaxAge,
  })
  return res
}
