import { NextRequest, NextResponse } from 'next/server'
import { randomBytes, createHash } from 'crypto'
import { db } from '@/lib/db'

const LOGIN_HOST = process.env.LOGIN_HOST ?? 'login.oliverstreetcreative.com'
const MAGIC_LINK_TTL_MINUTES = 15

async function sendEmail(to: string, subject: string, html: string) {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) throw new Error('RESEND_API_KEY not configured')

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'Oliver Street Creative <portal@send.oliverstreetcreative.com>',
      to: [to],
      subject,
      html,
    }),
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Resend ${res.status}: ${body}`)
  }
}

export async function POST(req: NextRequest) {
  let email: string
  try {
    const body = await req.json()
    email = String(body?.email ?? '').trim().toLowerCase()
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }

  if (!email || !email.includes('@')) {
    return NextResponse.json({ error: 'Invalid email' }, { status: 400 })
  }

  const person = await db.person.findUnique({
    where: { email },
    select: { id: true, portal_allowed: true },
  })

  // Always respond 200 so we don't leak whether an email is registered.
  if (!person || !person.portal_allowed) {
    return NextResponse.json({ ok: true })
  }

  const rawToken = randomBytes(32).toString('hex')
  const tokenHash = createHash('sha256').update(rawToken).digest('hex')
  const expiresAt = new Date(Date.now() + MAGIC_LINK_TTL_MINUTES * 60 * 1000)

  await db.portalInvite.create({
    data: {
      person_id: person.id,
      magic_link_hash: tokenHash,
      expires_at: expiresAt,
    },
  })

  const link = `https://${LOGIN_HOST}/magic?token=${rawToken}`
  const html = `
    <div style="font-family: -apple-system, system-ui, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; color: #1a1a1a;">
      <p>Click below to sign in to the Oliver Street Creative portal. This link expires in ${MAGIC_LINK_TTL_MINUTES} minutes and can only be used once.</p>
      <p style="margin: 24px 0;">
        <a href="${link}" style="display: inline-block; background: #1a1a1a; color: #fff; text-decoration: none; padding: 12px 20px; border-radius: 6px;">Sign in to OSC Portal</a>
      </p>
      <p style="color: #666; font-size: 13px;">If you didn't request this, you can safely ignore this email.</p>
      <p style="color: #666; font-size: 13px;">If the button doesn't work, paste this URL into your browser:<br/><span style="word-break: break-all;">${link}</span></p>
    </div>
  `

  try {
    await sendEmail(email, 'Your OSC Portal sign-in link', html)
  } catch (err) {
    console.error('magic-link send failed:', err)
    return NextResponse.json({ error: 'Email delivery failed' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
