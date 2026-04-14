import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { generateMagicLinkToken } from '@/lib/auth'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(req: NextRequest) {
  const body = await req.json()
  const email = body?.email

  if (typeof email !== 'string') {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const user = await db.person.findUnique({
    where: { email: email.toLowerCase().trim() },
  })

  if (!user || !user.portal_allowed) {
    return NextResponse.json({ ok: true })
  }

  const { raw, hash } = generateMagicLinkToken()
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000)

  await db.portalInvite.deleteMany({
    where: {
      person_id: user.id,
      accepted_at: null,
      expires_at: { gt: new Date() },
    },
  })

  await db.portalInvite.create({
    data: {
      person_id: user.id,
      magic_link_hash: hash,
      expires_at: expiresAt,
    },
  })

  const baseUrl =
    process.env.MAGIC_LINK_URL_BASE ?? 'https://login.oliverstreetcreative.com'
  const url = `${baseUrl}/magic?token=${raw}`

  if (process.env.NODE_ENV === 'development') {
    console.log('[magic-link]', url)
  }

  try {
    await resend.emails.send({
      from: 'Oliver Street Creative <portal@oliverstreetcreative.com>',
      to: user.email,
      subject: 'Your login link — Oliver Street Creative',
      html: [
        '<p>Click the link below to sign in to your portal:</p>',
        `<p><a href="${url}">Sign in to Oliver Street Creative</a></p>`,
        '<p>This link expires in 15 minutes.</p>',
      ].join(''),
    })
  } catch (err) {
    console.error('[magic-link] Failed to send email:', err)
  }

  return NextResponse.json({ ok: true })
}
