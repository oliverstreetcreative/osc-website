import type { Metadata } from "next"
import { VillageLoginForm } from "./login-form"

export const metadata: Metadata = {
  title: "Video Village — Enter password",
  robots: { index: false, follow: false },
}

export default function VillageLoginPage() {
  return <VillageLoginForm />
}
