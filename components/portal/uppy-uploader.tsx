"use client"

import '@uppy/core/dist/style.min.css'
import '@uppy/dashboard/dist/style.min.css'

import Uppy, { BasePlugin, type PluginOpts, type UppyFile } from '@uppy/core'
// @ts-ignore
import Dashboard from '@uppy/react/lib/Dashboard.js'
import { MutableRefObject, useEffect, useRef, useState } from 'react'

interface PortalUploaderProps {
  projectId: string
  uploadContext?: string
  maxFileSize?: number
  onUploadComplete?: (result: {
    upload_id: string
    dropbox_path: string
    filename: string
  }) => void
  onUploadError?: (error: string) => void
}

interface InitiateResponse {
  upload_id: string
  session_id: string
  chunk_size: number
  filename: string
}

interface ChunkedDropboxUploadOpts extends PluginOpts {
  projectId: string
  uploadContext?: string
  callbackRefs: {
    onUploadComplete: MutableRefObject<PortalUploaderProps['onUploadComplete']>
    onUploadError: MutableRefObject<PortalUploaderProps['onUploadError']>
  }
}

class ChunkedDropboxUpload extends BasePlugin<ChunkedDropboxUploadOpts, any, any> {
  private boundHandleUpload: (fileIDs: string[]) => Promise<void>

  constructor(uppy: Uppy<any, any>, opts: ChunkedDropboxUploadOpts) {
    super(uppy, opts)
    this.id = 'ChunkedDropboxUpload'
    this.type = 'uploader'
    this.boundHandleUpload = this.handleUpload.bind(this)
  }

  install() {
    this.uppy.addUploader(this.boundHandleUpload)
  }

  uninstall() {
    this.uppy.removeUploader(this.boundHandleUpload)
  }

  async handleUpload(fileIDs: string[]) {
    for (const id of fileIDs) {
      const file = this.uppy.getFile(id)
      try {
        await this.uploadFile(file)
      } catch (err) {
        this.uppy.emit('upload-error', file, err as Error)
        this.opts.callbackRefs.onUploadError.current?.(
          (err as Error).message ?? String(err)
        )
      }
    }
  }

  async uploadFile(file: UppyFile<any, any>) {
    const initiateRes = await fetch('/api/upload/initiate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filename: file.name,
        size: file.size,
        project_id: this.opts.projectId,
        upload_context: this.opts.uploadContext,
      }),
    })

    if (!initiateRes.ok) {
      throw new Error(
        `Initiate failed: ${initiateRes.status} ${initiateRes.statusText}`
      )
    }

    const { upload_id, session_id, chunk_size, filename }: InitiateResponse =
      await initiateRes.json()

    const fileData = file.data as Blob
    const totalSize = file.size ?? fileData.size
    let offset = 0
    const uploadStarted = Date.now()

    while (offset < totalSize) {
      const chunk = fileData.slice(offset, offset + chunk_size)
      const meta = btoa(JSON.stringify({ upload_id, session_id, offset }))

      const chunkRes = await fetch('/api/upload/chunk', {
        method: 'POST',
        headers: { 'X-Upload-Meta': meta },
        body: chunk,
      })

      if (!chunkRes.ok) {
        throw new Error(
          `Chunk upload failed at offset ${offset}: ${chunkRes.status} ${chunkRes.statusText}`
        )
      }

      offset += chunk.size

      this.uppy.emit('upload-progress', file, {
        uploadStarted,
        bytesUploaded: offset,
        bytesTotal: totalSize,
      })
    }

    const finishRes = await fetch('/api/upload/finish', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        upload_id,
        session_id,
        project_id: this.opts.projectId,
        filename,
        file_size: totalSize,
        upload_context: this.opts.uploadContext,
        mime_type: file.type,
      }),
    })

    if (!finishRes.ok) {
      throw new Error(
        `Finish failed: ${finishRes.status} ${finishRes.statusText}`
      )
    }

    const result = await finishRes.json()

    this.uppy.emit('upload-success', file, { status: 200, body: result })
    this.opts.callbackRefs.onUploadComplete.current?.({
      upload_id: result.upload_id,
      dropbox_path: result.dropbox_path,
      filename,
    })
  }
}

export default function PortalUploader({
  projectId,
  uploadContext,
  maxFileSize,
  onUploadComplete,
  onUploadError,
}: PortalUploaderProps) {
  const onUploadCompleteRef = useRef(onUploadComplete)
  const onUploadErrorRef = useRef(onUploadError)

  useEffect(() => {
    onUploadCompleteRef.current = onUploadComplete
    onUploadErrorRef.current = onUploadError
  })

  const [uppy] = useState(() =>
    new Uppy({
      restrictions: {
        maxFileSize: maxFileSize ?? 2 * 1024 * 1024 * 1024,
      },
      autoProceed: false,
    }).use(ChunkedDropboxUpload, {
      projectId,
      uploadContext,
      callbackRefs: {
        onUploadComplete: onUploadCompleteRef,
        onUploadError: onUploadErrorRef,
      },
    })
  )

  useEffect(() => {
    const plugin = uppy.getPlugin('ChunkedDropboxUpload') as
      | ChunkedDropboxUpload
      | undefined
    if (plugin) {
      plugin.setOptions({ projectId, uploadContext })
    }
  }, [uppy, projectId, uploadContext])

  useEffect(() => {
    return () => {
      uppy.destroy()
    }
  }, [uppy])

  return (
    <div>
      <Dashboard
        uppy={uppy}
        note="Files over 2GB: contact us for a direct upload link."
        proudlyDisplayPoweredByUppy={false}
      />
    </div>
  )
}
