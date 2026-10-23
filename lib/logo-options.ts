// The header-logo options' data and logic, STAGING ONLY (website-redesign SPEC Feature 6; Sam 10/8 ~14:55: "Show me
// the proposed reel and logo on the website"). components/site/LogoOptions.tsx draws them; lib/logo-options.test.ts
// pins them. The numbers come from the renderer that drew Sam's comparison page (Matters/website-redesign/wordmark).

export const LOGO_OPTIONS = [
  { key: "a", label: "A", long: "A · stacked" },
  { key: "b", label: "B", long: "B · smaller Creative" },
  { key: "c", label: "C", long: "C · the band" },
  { key: "d76", label: "D 76", long: "D · 76%" },
  { key: "d83", label: "D 83", long: "D · 83%" },
  { key: "d90", label: "D 90", long: "D · 90%" },
  { key: "now", label: "Now", long: "Now · today's" },
] as const
export type LogoKey = (typeof LOGO_OPTIONS)[number]["key"]
/** Majordomo's brief, 10/8: default d83 (the worker's one-line pick on the comparison page). */
export const LOGO_DEFAULT: LogoKey = "d83"

/** The caps (Barlow Condensed 600 at 19px) stand 0.708 em = 13.45px; Lobster's lowercase body (the top of "e") is
 *  0.509 em. Option D keeps the C at today's 18px and sets "reative" so its body stands at 76/83/90% of the caps. */
export const CAPS_PX = 19
export const CAP_EM = 0.708
export const LOBSTER_BODY_EM = 0.509
export const D_RATIOS = { d76: 0.76, d83: 0.83, d90: 0.9 } as const
export const D_SIZES: Record<keyof typeof D_RATIOS, number> = { d76: 20.09, d83: 21.94, d90: 23.79 }

/** Runs before the header paints: ?logo= wins and is remembered (localStorage, so every page keeps it); else the last
 *  pick; else the default. Without JS the default shows (logoCss's no-data-logo rules). */
export const LOGO_SCRIPT = `(function(){try{var k=${JSON.stringify(LOGO_OPTIONS.map((o) => o.key))},d=${JSON.stringify(
  LOGO_DEFAULT,
)},q=new URLSearchParams(location.search).get("logo"),s=null;try{s=localStorage.getItem("osc-logo")}catch(e){}var v=k.indexOf(q)>=0?q:k.indexOf(s)>=0?s:d;if(k.indexOf(q)>=0){try{localStorage.setItem("osc-logo",q)}catch(e){}}document.documentElement.setAttribute("data-logo",v)}catch(e){}})();`

/** Which option shows, which label the toggle wears and which link is lit: one rule set per option, generated from
 *  LOGO_OPTIONS so the CSS can never miss a key the script accepts. No data-logo (no JS) = the default. */
export function logoCss(): string {
  const set = (on: string, key: string) =>
    `${on} .site-logo-opt[data-opt="${key}"]{display:flex}` +
    `${on} .site-logo-cur[data-opt="${key}"]{display:inline}` +
    `${on} .site-logo-switch a[data-opt="${key}"]{background:var(--accent-fill);color:var(--deep)}`
  return LOGO_OPTIONS.map((o) => set(`html[data-logo="${o.key}"]`, o.key)).join("") + set("html:not([data-logo])", LOGO_DEFAULT)
}
