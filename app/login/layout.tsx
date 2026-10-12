import { barlow, lobster } from "@/components/site/fonts"
import { LOOK_SCRIPT } from "@/lib/client/theme"
import { LookApplier } from "../client/look"
import "../client/client.css"


export const metadata = { title: "Sign in · Oliver Street Creative" }

// A second root for the client site (SPEC §20): a portal root (.cs-app) with this device's Appearance, like /client.
export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`cs cs-app ${barlow.variable} ${lobster.variable}`}>
      <script dangerouslySetInnerHTML={{ __html: LOOK_SCRIPT }} />
      <LookApplier />
      {children}
    </div>
  )
}
