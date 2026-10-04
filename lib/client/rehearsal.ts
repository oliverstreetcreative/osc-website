// Rehearsal clients (SPEC §25 v2): staging-only test clients whose books live in their own tree,
// _admin/client-site/rehearsal/ (published/, preview/, published/library/, files/<slug>/). Only STAGING reads them;
// production hides any `rehearsal-` org and never lists the tree. Their records always go to the *-staging ledgers.
export const REHEARSAL_PREFIX = "rehearsal-"
export const isRehearsalSlug = (slug: string | null | undefined) => !!slug && slug.startsWith(REHEARSAL_PREFIX)
export const REHEARSAL_ROOT = "/_admin/client-site/rehearsal"
export const REHEARSAL_PUBLISHED = `${REHEARSAL_ROOT}/published`
export const REHEARSAL_PREVIEW = `${REHEARSAL_ROOT}/preview`
/** A rehearsal book's files must sit inside its own folder (the base slug, without --preview). */
export const rehearsalFolder = (slug: string) => `${REHEARSAL_ROOT}/files/${slug.replace(/--preview$/, "")}/`
/** People in a rehearsal book are OSC plus-addresses only (sam+…@oliverstreetcreative.com). */
export const isRehearsalPerson = (email: string) => {
  const e = email.trim().toLowerCase()
  return e.endsWith("@oliverstreetcreative.com") && e.split("@")[0].includes("+")
}
