import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { IntakeLayout } from "../components/intake/shared"
import SurveyRenderer from "../components/intake/survey-renderer"
import { getFormDefinition } from "@/lib/form-definitions"

const FORM_SLUG = "locations"

// Force dynamic rendering so form-definition updates take effect within the
// 60-second cache window, rather than being baked into the build.
export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title:
    "Submit a Filming Location | Oliver Street Creative | Cincinnati & NKY",
  description:
    "Have a unique space? Submit your location to the Oliver Street Creative filming location database. We're looking for homes, businesses, outdoor spaces, and more in the Cincinnati/NKY area.",
  keywords:
    "filming locations Cincinnati, film location scout Kentucky, rent location for filming, filming location database Ohio, production location Cincinnati, film-friendly locations Northern Kentucky",
  alternates: {
    canonical: "https://oliverstreetcreative.com/locations",
  },
  openGraph: {
    title: "Submit a Filming Location — Oliver Street Creative",
    description:
      "Got a great space? Add it to our location database for upcoming film and video productions in Cincinnati and Northern Kentucky.",
    url: "https://oliverstreetcreative.com/locations",
    siteName: "Oliver Street Creative",
    type: "website",
  },
}

export default async function LocationsPage() {
  const definition = await getFormDefinition(FORM_SLUG)
  if (!definition) {
    notFound()
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "WebPage",
            name: "Filming Location Database — Oliver Street Creative",
            description:
              "Submit your property or space to the Oliver Street Creative filming location database. Serving the Greater Cincinnati and Northern Kentucky area.",
            publisher: {
              "@type": "Organization",
              name: "Oliver Street Creative",
              url: "https://oliverstreetcreative.com",
            },
            areaServed: [
              { "@type": "City", name: "Cincinnati" },
              { "@type": "City", name: "Covington" },
              { "@type": "State", name: "Kentucky" },
            ],
          }),
        }}
      />
      <IntakeLayout
        title={definition.title}
        subtitle={definition.subtitle || ""}
      >
        <SurveyRenderer slug={FORM_SLUG} surveyJson={definition.surveyJson} />
      </IntakeLayout>
    </>
  )
}
