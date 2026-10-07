// Telling Sam about deputies (client-website SPEC §27 P1 v2 #8). Every grant and revoke reaches him twice: an email to
// the owner, and a flag Majordomo reads. The owner rests on one mailbox, so the flag is the second witness.
import { writeNewFile } from "@/lib/client/dropbox-write"
import { ledgerDir } from "@/lib/client/rehearsal"
import { IS_PRODUCTION } from "@/lib/site-env"
import { mayEmail, sendEmail } from "@/lib/auth/door"
import { ownerEmail } from "./subjects"

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!)

export async function tellOwner(kind: "deputy_grant" | "deputy_revoke", headline: string, lines: string[]): Promise<void> {
  const owner = ownerEmail()
  const html = `<div style="font-family: -apple-system, system-ui, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; color: #1a1a1a;">
      <p><b>${esc(headline)}</b></p>
      ${lines.map((l) => `<p>${esc(l)}</p>`).join("")}
      <p style="color: #666; font-size: 13px;">Not you? Revoke it on your Deputies page, and text Majordomo.</p>
    </div>`
  const sends: Promise<unknown>[] = []
  if (owner && mayEmail(owner)) sends.push(sendEmail(owner, headline, html).catch((err) => console.error("deputies: owner email failed:", err)))
  const name = `${kind}_${new Date().toISOString().replace(/[^0-9]/g, "").slice(0, 14)}_${Math.random().toString(36).slice(2, 8)}.json`
  const body = { what: `${headline} ${lines.join(" ")}`, kind, seen_at: new Date().toISOString() }
  sends.push(
    writeNewFile(`${ledgerDir("flags", null, IS_PRODUCTION)}/${name}`, JSON.stringify(body, null, 2) + "\n").then((r) => {
      if (r !== "written" && r !== "exists") console.error(`deputies: flag write failed: ${r}`)
    }),
  )
  await Promise.all(sends)
}
