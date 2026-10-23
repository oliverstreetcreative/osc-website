// The one mail helper for Scripts (SPEC §14 v4 #11: one helper holds the staging allowlist). Server only.
// Staging NEVER emails anyone outside @oliverstreetcreative.com (it holds real client records for rehearsal).
// Emails carry the script title and who acted, never the script text or comment bodies (§14 "What can leak").
import { IS_STAGING } from "@/lib/site-env"
import { mayMailClient } from "@/lib/auth/signin-only"

export type MailResult = { sent: true } | { sent: false; why: string }

export const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!)

export async function sendScriptMail(to: string, subject: string, html: string): Promise<MailResult> {
  const email = to.trim().toLowerCase()
  if (IS_STAGING && !email.endsWith("@oliverstreetcreative.com")) return { sent: false, why: "staging only emails OSC addresses" }
  if (!mayMailClient(email)) return { sent: false, why: "the client site is in Sam's test phase: no client is emailed (CLIENT_SIGNIN_ONLY)" }
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return { sent: false, why: "email isn't configured" }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: "Oliver Street Creative <portal@send.oliverstreetcreative.com>", to: [email], subject, html }),
  }).catch(() => null)
  if (!res?.ok) return { sent: false, why: `the mail service said ${res?.status ?? "nothing"}` }
  return { sent: true }
}

/** "Sam shared “Harmon SoS” with you" + one button. */
export function inviteEmail(sharer: string, title: string, link: string) {
  const t = escapeHtml(title)
  const s = escapeHtml(sharer)
  return {
    subject: `${sharer} shared “${title}” with you`,
    html: `
    <div style="font-family: -apple-system, system-ui, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; color: #1a1a1a;">
      <p>${s} at Oliver Street Creative shared the script <b>${t}</b> with you.</p>
      <p style="margin: 24px 0;">
        <a href="${link}" style="display: inline-block; background: #1a1a1a; color: #fff; text-decoration: none; padding: 12px 20px; border-radius: 6px;">Open the script</a>
      </p>
      <p style="color: #666; font-size: 13px;">The link works for 14 days and signs you in; no password. If the button doesn't work, paste this into your browser:<br/><span style="word-break: break-all;">${link}</span></p>
    </div>`,
  }
}
