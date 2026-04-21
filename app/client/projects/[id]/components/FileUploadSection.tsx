'use client'

import { useState } from 'react'
import PortalUploader from '@/components/portal/uppy-uploader'

interface FileUploadSectionProps {
  projectId: string
}

export default function FileUploadSection({ projectId }: FileUploadSectionProps) {
  const [showUploader, setShowUploader] = useState(false)
  const [lastUpload, setLastUpload] = useState<string | null>(null)

  return (
    <div style={{ marginTop: '16px' }}>
      {!showUploader ? (
        <button
          onClick={() => setShowUploader(true)}
          style={{
            display: 'inline-block',
            fontSize: '13px',
            fontWeight: 600,
            color: 'var(--orange)',
            textDecoration: 'none',
            padding: '8px 16px',
            border: '1px solid rgba(224,120,48,0.4)',
            borderRadius: '6px',
            background: 'transparent',
            cursor: 'pointer',
          }}
        >
          Upload Files →
        </button>
      ) : (
        <div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '12px',
            }}
          >
            <span
              style={{
                fontSize: '13px',
                fontWeight: 600,
                color: 'var(--paper)',
              }}
            >
              Upload files to this project
            </span>
            <button
              onClick={() => setShowUploader(false)}
              style={{
                fontSize: '12px',
                color: 'var(--quiet)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                textDecoration: 'underline',
              }}
            >
              Cancel
            </button>
          </div>
          <PortalUploader
            projectId={projectId}
            uploadContext="asset"
            onUploadComplete={(result) => {
              setLastUpload(result.filename)
            }}
          />
          {lastUpload && (
            <p
              style={{
                marginTop: '8px',
                fontSize: '13px',
                color: 'var(--green)',
              }}
            >
              Uploaded: {lastUpload}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
