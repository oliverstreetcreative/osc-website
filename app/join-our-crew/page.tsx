import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { IntakeLayout } from "../components/intake/shared"
import SurveyRenderer from "../components/intake/survey-renderer"
import { getFormDefinition } from "@/lib/form-definitions"

const FORM_SLUG = "crew"

// Force dynamic rendering so form-definition updates take effect within the
// 60-second cache window, rather than being baked into the build.
export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title:
    "Join Our Crew | Oliver Street Creative | Cincinnati Film Crew Jobs",
  description:
    "Looking for video production work in Cincinnati or Northern Kentucky? Join the Oliver Street Creative crew — we're hiring freelance camera operators, editors, gaffers, PAs, and more.",
  keywords:
    "Cincinnati film crew, videographer jobs Cincinnati, production assistant jobs Ohio, freelance camera operator Kentucky, video production jobs, film crew Cincinnati, gaffer jobs, editor jobs Cincinnati",
  alternates: {
    canonical: "https://oliverstreetcreative.com/join-our-crew",
  },
  openGraph: {
    title: "Join Our Crew — Oliver Street Creative",
    description:
      "We're building a crew of talented, low-ego professionals for video production in the Cincinnati/NKY region. Apply now.",
    url: "https://oliverstreetcreative.com/join-our-crew",
    siteName: "Oliver Street Creative",
    type: "website",
  },
}

export default async function JoinOurCrewPage() {
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
            "@type": "JobPosting",
            title: "Freelance Video Production Crew",
            description:
              "Oliver Street Creative is looking for freelance crew members across all departments — camera, grip/electric, editorial, production design, sound, and more. Cincinnati/NKY region.",
            hiringOrganization: {
              "@type": "Organization",
              name: "Oliver Street Creative",
              sameAs: "https://oliverstreetcreative.com",
              logo: "https://oliverstreetcreative.com/logo.png",
            },
            jobLocation: {
              "@type": "Place",
              address: {
                "@type": "PostalAddress",
                addressLocality: "Covington",
                addressRegion: "KY",
                addressCountry: "US",
              },
            },
            employmentType: "CONTRACTOR",
            jobLocationType: "TELECOMMUTE",
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
