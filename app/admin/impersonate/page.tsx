// RETIRED (client-website SPEC §27 P0 v2): staff look at a client's site with "View as client" (read-only, logged).
import { redirect } from 'next/navigation'

export const metadata = { title: 'View as client | OSC Admin' }

export default function ImpersonatePage() {
  redirect('/client/view-as')
}
