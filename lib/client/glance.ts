// The one-glance Home (SPEC §28 v2): on for these clients first. When Sam approves Torres's portal it becomes every
// client's default: change glanceHome to return true (one line), and delete the classic Home.
const GLANCE = new Set(["torres-consulting", "torres-consulting--preview"])

export const glanceHome = (slug: string | null | undefined) => !!slug && GLANCE.has(slug)
