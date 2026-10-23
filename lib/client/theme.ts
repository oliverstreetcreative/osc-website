// Appearance (SPEC §20 v2, with the shoot-day hub's conventions per the 10/3 09:55 ruling): Auto (follow the phone)
// / Light / Dark, remembered on THIS device in localStorage `osc.portal.look` (the hub keeps `osc.hub.look`), applied
// as <html data-look="light|dark"> (absent = Auto). Client-safe: no server imports here.

export const LOOK_KEY = "osc.portal.look"
export type Look = "auto" | "light" | "dark"

/** Runs inline while the page is parsed, before the portal paints, so a stored choice never flashes. */
export const LOOK_SCRIPT = `(function(){try{var v=localStorage.getItem(${JSON.stringify(LOOK_KEY)}),d=document.documentElement;if(v==="light"||v==="dark")d.setAttribute("data-look",v);else d.removeAttribute("data-look")}catch(e){}})()`

export function readLook(): Look {
  try {
    const v = window.localStorage.getItem(LOOK_KEY)
    return v === "light" || v === "dark" ? v : "auto"
  } catch {
    return "auto"
  }
}

export function applyLook(v: Look) {
  const d = document.documentElement
  if (v === "light" || v === "dark") d.setAttribute("data-look", v)
  else d.removeAttribute("data-look")
}

export function storeLook(v: Look) {
  try {
    if (v === "auto") window.localStorage.removeItem(LOOK_KEY)
    else window.localStorage.setItem(LOOK_KEY, v)
  } catch {
    /* private mode or blocked storage: the choice lasts for this page only */
  }
}
