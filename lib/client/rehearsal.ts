// Rehearsal clients (SPEC §25 v2): staging-only test clients whose books live in their own tree,
// _admin/client-site/rehearsal/ (published/, preview/, published/library/, files/<slug>/). Only STAGING reads them;
// production hides any `rehearsal-` org and never lists the tree. Their records always go to the *-staging ledgers.
// Pure functions only (tested in rehearsal.test.ts); no database here.
export const REHEARSAL_PREFIX = "rehearsal-"
export const isRehearsalSlug = (slug: string | null | undefined) => !!slug && slug.startsWith(REHEARSAL_PREFIX)
export const REHEARSAL_ROOT = "/_admin/client-site/rehearsal"
export const REHEARSAL_PUBLISHED = `${REHEARSAL_ROOT}/published`
export const REHEARSAL_PREVIEW = `${REHEARSAL_ROOT}/preview`
/** A rehearsal book's files must sit inside its own folder (the base slug, without --preview). */
export const rehearsalFolder = (slug: string) => `${REHEARSAL_ROOT}/files/${slug.replace(/--preview$/, "")}/`
/**
 * Sign Here's STAGING twin (SPEC §22 v2.1). Sign Here's staging engine holds ONE bundled test org, `osc-staging-test`
 * (job 99-002: the phone proof as sam+client-test@). Its portal twin is a rehearsal client named after it, so it lives
 * only on staging; `signOrgFor` (sign.ts) tells the engine the twin is `osc-staging-test`. The gate keeps a copy
 * (client_gate.py SIGN_TWIN; a test checks they match).
 */
export const SIGN_TWIN = {
  slug: "rehearsal-osc-staging-test",
  signOrg: "osc-staging-test",
  email: "sam+client-test@oliverstreetcreative.com",
} as const

/**
 * The test client Sam plays on staging, "OSC Internal Videos" (SPEC §31 v2): the new-client and new-project flows run
 * through it. Its book alone may name internal@ (Sam signs in as that address), and its own name and folder may carry
 * the word the gate's internal-marker lint looks for. The gate keeps a copy (client_gate.py INTERNAL_TEST; a test
 * checks they match).
 */
export const INTERNAL_TEST = {
  slug: "rehearsal-osc-internal",
  name: "OSC Internal Videos",
  email: "internal@oliverstreetcreative.com",
} as const

/** People in a rehearsal book are +rehearsal OSC addresses only (sam+rehearsal@oliverstreetcreative.com). The two
 *  exceptions, each only in its own book: Sign Here staging's test person (SPEC §22 v2.1) and internal@ (§31 v2). */
export const isRehearsalPerson = (email: string, slug?: string) => {
  const e = email.trim().toLowerCase()
  if (e.endsWith("@oliverstreetcreative.com") && e.split("@")[0].includes("+rehearsal")) return true
  if (slug === INTERNAL_TEST.slug && e === INTERNAL_TEST.email) return true
  return slug === SIGN_TWIN.slug && e === SIGN_TWIN.email
}

/** A plain root-relative path (no "..", ".", empty segments or backslashes): the only kind ever checked by prefix. */
export const plainPath = (p: string) =>
  p.startsWith("/") && !p.includes("\\") && !p.includes("\0") && p.split("/").slice(1).every((s) => s !== "" && s !== "." && s !== "..")

/** Every root-relative file path a book names (document, film file/poster, download, project poster, invoice PDF). */
export function bookPaths(book: { projects?: unknown; invoices?: unknown; documents?: unknown }): string[] {
  const out: string[] = []
  const walk = (o: unknown) => {
    if (Array.isArray(o)) o.forEach(walk)
    else if (o && typeof o === "object") {
      for (const [k, v] of Object.entries(o)) {
        if ((k === "path" || k === "file" || k === "poster" || k === "pdf") && typeof v === "string") out.push(v)
        else walk(v)
      }
    }
  }
  walk({ projects: book.projects, invoices: book.invoices, documents: book.documents })
  return out
}

/** A rehearsal book's paths that aren't plainly inside its own folder (empty = all good). */
export const pathsOutside = (slug: string, paths: string[]) => paths.filter((p) => !plainPath(p) || !p.startsWith(rehearsalFolder(slug)))

/** A REAL book's signs of rehearsal data: a 99- job, or a path into the rehearsal tree. */
export function rehearsalTraces(book: { projects?: { job_number?: string | null }[] } & Parameters<typeof bookPaths>[0]): string[] {
  const out: string[] = []
  for (const p of (book.projects ?? []) as { job_number?: string | null }[]) if (p.job_number?.startsWith("99-")) out.push(`job ${p.job_number}`)
  for (const x of bookPaths(book)) if (x.startsWith(`${REHEARSAL_ROOT}/`)) out.push(x)
  return out
}

/**
 * The ledger folder for one org's records: production writes the real one; every other environment, and a rehearsal
 * client in ANY environment, writes the -staging one, which the gate and Majordomo never act on.
 */
export const ledgerDir = (name: string, orgSlug: string | null | undefined, isProduction: boolean) =>
  `/_admin/client-site/ledger/${name}${isProduction && !isRehearsalSlug(orgSlug) ? "" : "-staging"}`
