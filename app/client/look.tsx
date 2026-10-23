"use client"
// Keeps <html data-look> in step with the stored Appearance (SPEC §20 v2, hub conventions): on arrival by a soft
// navigation (the inline head script only runs on a full load), on a page restored by Back, and when another tab
// changes it.
import { useEffect } from "react"
import { LOOK_KEY, applyLook, readLook } from "@/lib/client/theme"

export function LookApplier() {
  useEffect(() => {
    applyLook(readLook())
    const onStorage = (e: StorageEvent) => {
      if (e.key === LOOK_KEY) applyLook(readLook())
    }
    const onShow = (e: PageTransitionEvent) => {
      if (e.persisted) applyLook(readLook())
    }
    window.addEventListener("storage", onStorage)
    window.addEventListener("pageshow", onShow)
    return () => {
      window.removeEventListener("storage", onStorage)
      window.removeEventListener("pageshow", onShow)
    }
  }, [])
  return null
}
