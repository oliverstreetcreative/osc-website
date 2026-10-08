import { redirect } from "next/navigation"

// Retired with Start a project v3 (SPEC §31 v2): Send lands on Home, where the request shows as a project in Quote.
// Old links (and bookmarks) land there too.
export default function Sent() {
  redirect("/client")
}
