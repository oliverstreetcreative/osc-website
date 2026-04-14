import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { requirePortalUser } from '@/lib/portal-auth'
import { db } from '@/lib/db'
import { TestimonialForm } from './TestimonialForm'

interface Props {
  params: Promise<{ id: string }>
}

export const metadata = {
  title: 'Share Your Experience — OSC Client Portal',
}

export default async function TestimonialPage({ params }: Props) {
  const { id } = await params

  let user
  try {
    user = await requirePortalUser()
  } catch {
    redirect('/login')
  }

  // Verify access
  const participant = await db.projectParticipant.findFirst({
    where: {
      person_id: user.id,
      project_id: id,
      project: { client_portal_enabled: true },
    },
  })

  if (!participant) notFound()

  const project = await db.project.findUnique({
    where: { id },
    select: { id: true, name: true, phase: true, client_portal_enabled: true },
  })

  if (!project) notFound()

  // Check for existing testimonial
  const existingTestimonial = await db.testimonial.findFirst({
    where: { project_id: id, person_id: user.id },
  })

  return (
    <div style={{ maxWidth: '600px' }}>
      {/* Breadcrumb */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          marginBottom: '24px',
          fontSize: '13px',
          color: 'var(--quiet)',
        }}
      >
        <Link href="/client" style={{ color: 'var(--quiet)', textDecoration: 'none' }}>
          Dashboard
        </Link>
        <span style={{ color: 'var(--faint)' }}>/</span>
        <Link
          href={`/client/projects/${id}`}
          style={{ color: 'var(--quiet)', textDecoration: 'none' }}
        >
          {project.name}
        </Link>
        <span style={{ color: 'var(--faint)' }}>/</span>
        <span style={{ color: 'var(--paper)' }}>Share Your Experience</span>
      </div>

      {existingTestimonial ? (
        /* Already submitted — show thank-you state */
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
            gap: '16px',
            padding: '40px 0',
          }}
        >
          <div
            style={{
              width: '52px',
              height: '52px',
              borderRadius: '50%',
              background: 'var(--green)',
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '22px',
              fontWeight: 700,
            }}
          >
            ✓
          </div>
          <h1
            style={{
              fontFamily: 'var(--font-inter)',
              fontWeight: 900,
              fontSize: '26px',
              letterSpacing: '-0.02em',
            }}
          >
            Thank You!
          </h1>
          <p style={{ fontSize: '15px', color: 'var(--quiet)', maxWidth: '400px' }}>
            Your testimonial for <strong style={{ color: 'var(--paper)' }}>{project.name}</strong>{' '}
            has been received.
          </p>
          <blockquote
            style={{
              borderLeft: '3px solid var(--green)',
              paddingLeft: '16px',
              fontStyle: 'italic',
              fontSize: '15px',
              color: 'var(--quiet)',
              lineHeight: 1.65,
              textAlign: 'left',
              maxWidth: '480px',
            }}
          >
            "{existingTestimonial.quote_text}"
          </blockquote>
          {existingTestimonial.context && (
            <p style={{ fontSize: '13px', color: 'var(--faint)' }}>{existingTestimonial.context}</p>
          )}
          <p style={{ fontSize: '12px', color: 'var(--faint)', fontStyle: 'italic' }}>
            {existingTestimonial.permission_status === 'granted'
              ? 'You have granted permission to use this testimonial in marketing materials.'
              : 'Permission to use in marketing materials was not granted.'}
          </p>
          <Link
            href="/client"
            style={{
              fontSize: '13px',
              fontWeight: 600,
              color: 'var(--orange)',
              textDecoration: 'none',
              padding: '8px 20px',
              border: '1px solid rgba(224,120,48,0.4)',
              borderRadius: '6px',
              marginTop: '8px',
            }}
          >
            Back to Dashboard
          </Link>
        </div>
      ) : (
        /* Show form */
        <div>
          <h1
            style={{
              fontFamily: 'var(--font-inter)',
              fontWeight: 900,
              fontSize: 'clamp(22px, 3vw, 30px)',
              letterSpacing: '-0.02em',
              marginBottom: '8px',
            }}
          >
            Share Your Experience
          </h1>
          <p style={{ fontSize: '15px', color: 'var(--quiet)', marginBottom: '32px' }}>
            Project: <strong style={{ color: 'var(--paper)' }}>{project.name}</strong>
          </p>
          <TestimonialForm projectId={id} projectName={project.name} />
        </div>
      )}
    </div>
  )
}
