"use client"
// The only client JS in the shell: knowing which tab you're on.
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Home, Clapperboard, Receipt, FileText, ScrollText } from "lucide-react"

const ITEMS = [
  { href: "/client", label: "Home", Icon: Home, exact: true },
  { href: "/client/projects", label: "Projects", Icon: Clapperboard },
  { href: "/client/scripts", label: "Scripts", Icon: ScrollText, scriptsOnly: true },
  { href: "/client/billing", label: "Billing", Icon: Receipt },
  { href: "/client/documents", label: "Documents", Icon: FileText },
]
// The Scripts tab shows only for someone who has a script shared with them (SPEC §14 phone moment 3).
const itemsFor = (scripts: boolean) => ITEMS.filter((i) => scripts || !i.scriptsOnly)

function useActive() {
  const raw = usePathname() ?? "/client"
  // On the client.* subdomain the URL has no /client prefix.
  const path = raw.startsWith("/client") ? raw : `/client${raw === "/" ? "" : raw}`
  return (href: string, exact?: boolean) => (exact ? path === href : path === href || path.startsWith(`${href}/`))
}

export function Nav({ scripts = false }: { scripts?: boolean }) {
  const active = useActive()
  return (
    <nav className="cs-nav" aria-label="Main">
      {itemsFor(scripts).map(({ href, label, exact }) => (
        <Link key={href} href={href} aria-current={active(href, exact) ? "page" : undefined}>
          {label}
        </Link>
      ))}
    </nav>
  )
}

export function Tabs({ scripts = false }: { scripts?: boolean }) {
  const active = useActive()
  return (
    <nav className="cs-tabs" aria-label="Main">
      {itemsFor(scripts).map(({ href, label, Icon, exact }) => (
        <Link key={href} href={href} aria-current={active(href, exact) ? "page" : undefined}>
          <Icon />
          {label}
        </Link>
      ))}
    </nav>
  )
}
