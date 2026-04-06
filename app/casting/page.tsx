import type { Metadata } from "next"
import { IntakeLayout } from "../components/intake/shared"
import CastingForm from "../components/intake/casting-form"

export const metadata: Metadata = {
  title:
    "Open Casting | Talent Database | Oliver Street Creative | Cincinnati",
  description:
    "Submit yourself to the Oliver Street Creative talent database. We cast actors, models, and background performers for video productions in Cincinnati and Northern Kentucky.",
  keywords:
    "Cincinnati casting calls, talent database Cincinnati, background actors Ohio, casting call Kentucky, open casting Cincinnati, models Cincinnati, film extras Cincinnati, SAG casting Ohio",
  alternates: {
    canonical: "https://oliverstreetcreative.com/casting",
  },
  openGraph: {
    title: "Open Casting — Oliver Street Creative Talent Database",
    description:
      "Add yourself to our talent database. We cast for commercials, brand films, and narrative projects in the Cincinnati/NKY area.",
    url: "https://oliverstreetcreative.com/casting",
    siteName: "Oliver Street Creative",
    type: "website",
  },
}

export default function CastingPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Event",
            name: "Oliver Street Creative — Open Casting / Talent Database",
            description:
              "Ongoing open casting call for actors, models, and background performers in the Cincinnati/Northern Kentucky area.",
            organizer: {
              "@type": "Organization",
              name: "Oliver Street Creative",
              url: "https://oliverstreetcreative.com",
            },
            location: {
              "@type": "Place",
              name: "Greater Cincinnati Area",
              address: {
                "@type": "PostalAddress",
                addressLocality: "Cincinnati",
                addressRegion: "OH",
                addressCountry: "US",
              },
            },
            eventAttendanceMode:
              "https://schema.org/OnlineEventAttendanceMode",
            eventStatus: "https://schema.org/EventScheduled",
            startDate: "2026-01-01",
          }),
        }}
      />
      <IntakeLayout
        title="Open Casting"
        subtitle="Add yourself to our talent database for upcoming productions."
      >
        <CastingForm />
      </IntakeLayout>
    </>
  )
}
