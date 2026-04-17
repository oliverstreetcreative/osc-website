import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { randomBytes, createHash } from 'crypto'
import { Resend } from 'resend'

const LOGIN_HOST = process.env.LOGIN_HOST ?? 'login.oliverstreetcreative.com'
const MAGIC_LINK_TTL_MS = 24 * 60 * 60 * 1000

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: { email?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const email = body.email?.trim().toLowerCase()
  if (!email) {
    return NextResponse.json({ error: 'Email required' }, { status: 400 })
  }

  const person = await db.person.findUnique({
    where: { email },
    select: { id: true, name: true, portal_allowed: true },
  })

  // Silent success even if person not found — prevents enumeration
  if (!person || !person.portal_allowed) {
    return NextResponse.json({ ok: true })
  }

  const rawToken = randomBytes(32).toString('hex')
  const tokenHash = createHash('sha256').update(rawToken).digest('hex')

  await db.portalInvite.create({
    data: {
      person_id: person.id,
      magic_link_hash: tokenHash,
      expires_at: new Date(Date.now() + MAGIC_LINK_TTL_MS),
    },
  })

  const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http'
  const magicUrl = `${protocol}://${LOGIN_HOST}/magic?token=${rawToken}`

  const resendKey = process.env.RESEND_API_KEY
  if (resendKey) {
    const resend = new Resend(resendKey)
    await resend.emails.send({
      from: 'Oliver Street Creative <portal@oliverstreetcreative.com>',
      to: email,
      subject: 'Your login link — Oliver Street Creative',
      html: `
        <p>Hi ${person.name},</p>
        <p>Click below to sign in to your portal:</p>
        <p><a href="${magicUrl}" style="display:inline-block;padding:12px 24px;background:#000;color:#fff;text-decoration:none;font-family:Inter,sans-serif;">Sign In</a></p>
        <p style="color:#666;font-size:13px;">This link expires in 24 hours. If you didn't request this, ignore this email.</p>
      `,
    })
  } else {
    console.warn('[auth] RESEND_API_KEY not set, magic link:', magicUrl)
  }

  return NextResponse.json({ ok: true })
}
