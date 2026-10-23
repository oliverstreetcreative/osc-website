// Which of a person's organizations a link or a form means (SPEC §30 v2, fixing §22 v2.1's known bug). Pure.
// A project page can show another of the person's orgs than the one selected (calendar links and emails don't know
// which is selected), so its Sign button and copy links carry the project's org. It's accepted only when it is one of
// the person's own orgs; the client context's `orgs` already leaves out hidden memberships, hidden orgs, and
// rehearsal orgs off staging.

/** Absent → the selected org (as before). Named and theirs → that org. Named and NOT theirs → null: refuse. */
export function memberOrg<O extends { slug: string }>(ctx: { org: O; orgs: O[] }, slug: string | null | undefined): O | null {
  if (slug === null || slug === undefined || slug === "") return ctx.org
  return ctx.orgs.find((o) => o.slug === slug) ?? null
}
