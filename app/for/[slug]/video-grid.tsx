'use client'

// Small film tiles open a native modal: focus stays inside, Escape closes,
// and closing returns focus to the film that opened it.
import { useEffect, useRef, useState } from 'react'
import type { WorkVideo } from '@/lib/work-videos'
import { muxEmbedSrc, muxThumbnail } from '@/lib/work-videos'

export function VideoGrid({ videos }: { videos: WorkVideo[] }) {
  const [open, setOpen] = useState<WorkVideo | null>(null)
  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    if (!open) return
    const modal = dialog.current
    modal?.showModal()
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      modal?.close()
      document.body.style.overflow = previous
    }
  }, [open])
  return (
    <>
      <div className="prospect-films">
        {videos.map((video) => (
          <button key={video.slug} type="button" className="prospect-film" onClick={() => setOpen(video)} aria-label={`Play ${video.title}`}>
            <div className="prospect-poster">
              <img src={muxThumbnail(video).replace('width=1920', 'width=960')} alt="" loading="lazy" />
              <span className="cs-play" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M8 5.5v13l10.5-6.5z" /></svg></span>
            </div>
            <span className="prospect-film-info">
              <img src={video.clientLogo} alt={video.clientName} style={{ filter: video.isLightLogo ? 'brightness(0)' : 'none' }} loading="lazy" />
              <span><strong>{video.title}</strong><small>{video.client}</small></span>
            </span>
          </button>
        ))}
      </div>
      <dialog ref={dialog} className="prospect-dialog" aria-label={open?.title ?? 'Film'} onClose={() => setOpen(null)} onClick={(event) => { if (event.target === event.currentTarget) dialog.current?.close() }}>
        {open ? (
          <>
            <div className="prospect-dialog-head">
              <strong>{open.title}</strong>
              <button type="button" autoFocus onClick={() => dialog.current?.close()}>Close ✕</button>
            </div>
            <div className="cs-player">
              <iframe src={`${muxEmbedSrc(open)}&autoplay=true`} title={open.title} allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen />
            </div>
            <p>{open.client}</p>
          </>
        ) : null}
      </dialog>
    </>
  )
}
