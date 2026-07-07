"use client"

import MuxPlayer from "@mux/mux-player-react"

const PLAYBACK_ID = "c6T2qTEjYR6SKWRotYGs28UAZZlYW5YmUXYCnPCLRG4"

export function VillagePlayer() {
  return (
    <main
      style={{
        position: "fixed",
        inset: 0,
        background: "black",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <MuxPlayer
        streamType="live"
        playbackId={PLAYBACK_ID}
        metadataVideoTitle="The Village"
        accentColor="#ffffff"
        style={{
          width: "100%",
          height: "100%",
          maxWidth: "100vw",
          maxHeight: "100vh",
        }}
      />
    </main>
  )
}
