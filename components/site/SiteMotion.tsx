"use client"

// The silo pages' settle-in + progress-bar FALLBACK, for browsers without
// scroll-driven animations (current iOS Safari and Chrome do it in CSS: site.css).
// A component, not an inline <script>, so it re-arms when someone comes BACK to the
// page through client-side navigation and cleans up after itself when they leave
// (an inline script runs once, and a back-navigation then left every line at
// opacity 0). It only adds a class to elements; it never touches text React rendered.

import { useEffect } from "react"

export function SiteMotion() {
  useEffect(() => {
    const html = document.documentElement
    const supports = (q: string) => typeof CSS !== "undefined" && typeof CSS.supports === "function" && CSS.supports(q)
    const undo: Array<() => void> = []

    if (!supports("animation-timeline: view()") && "IntersectionObserver" in window) {
      const items = Array.from(document.querySelectorAll<HTMLElement>(".r > *"))
      // Whatever is already on screen stays visible: no flicker on first paint.
      const fold = window.innerHeight * 0.88
      for (const el of items) {
        const r = el.getBoundingClientRect()
        if (r.top < fold && r.bottom > 0) el.classList.add("seen")
      }
      html.setAttribute("data-motion", "io")
      const io = new IntersectionObserver(
        (entries) => {
          for (const e of entries) {
            if (e.isIntersecting) {
              e.target.classList.add("seen")
              io.unobserve(e.target)
            }
          }
        },
        { rootMargin: "0px 0px -12% 0px" },
      )
      items.forEach((el) => {
        if (!el.classList.contains("seen")) io.observe(el)
      })
      undo.push(() => {
        io.disconnect()
        html.removeAttribute("data-motion")
      })
    }

    if (!supports("animation-timeline: scroll()")) {
      const update = () => {
        const bar = document.getElementById("site-prog")
        if (!bar) return
        const max = html.scrollHeight - html.clientHeight
        bar.style.setProperty("--p", max > 0 ? (html.scrollTop / max).toFixed(4) : "0")
      }
      window.addEventListener("scroll", update, { passive: true })
      window.addEventListener("resize", update)
      update()
      undo.push(() => {
        window.removeEventListener("scroll", update)
        window.removeEventListener("resize", update)
      })
    }

    return () => undo.forEach((fn) => fn())
  }, [])
  return null
}
