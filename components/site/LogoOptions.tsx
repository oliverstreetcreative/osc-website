// THE HEADER LOGO OPTIONS, on STAGING ONLY (website-redesign SPEC Feature 6). Sam, 10/8 ~14:55: "Show me the
// proposed reel and logo on the website." Majordomo: every option on staging with a switcher, ?logo=a|b|c|d76|d83|d90,
// default d83, plus a small staging-only toggle in the corner.
//
// They are the options on Sam's comparison page (Matters/website-redesign/wordmark/options.html), built here for real
// in the site's own faces (next/font's Barlow Condensed 600 + Lobster, via client.css's --wordmark / --script):
//   a    his stacked logo, knocked out of the dark bar: the master SVG's own geometry, live text
//   b    one line, the name a touch bigger and "Creative" smaller
//   c    one line, "Creative" in his logo's band, evened (the band fitted to the ink, Sam's 14:31 note)
//   d76/d83/d90   one line, the capital C as today and the lowercase "reative" raised to 76/83/90% of the caps'
//        height (his 14:33 idea; today's lowercase stands at ~68%)
//   now  today's mark, for comparison
// The numbers come from the renderer that drew the comparison page (wordmark/render.py), so what he flips here is what
// he saw there. The live site never sees any of this: SiteFrame renders today's Wordmark wherever drafts aren't
// allowed (lib/faq.ts draftsAllowed, fail closed). No client component: one inline script picks the option before the
// header paints, and plain links switch it. The data and logic live in lib/logo-options.ts (tested there).
import { Wordmark } from "@/app/client/ui"
import { D_SIZES, LOGO_OPTIONS } from "@/lib/logo-options"

export { LOGO_SCRIPT, logoCss } from "@/lib/logo-options"

/**
 * Sam's stacked logo from its master (OLIVER STREET CREATIVE/_assets/Branding/oliver_street_creative_logo-ink.svg):
 * the same groups, transforms and runs, in the site's own faces. `block` = the logo as drawn (the ink block: the
 * footer, on paper); without it, the block is knocked out (the dark top bar), cropped to the letters and the band.
 */
export function StackedLogo({ block = false, className }: { block?: boolean; className?: string }) {
  const viewBox = block ? "90.74 206.14 842.22 612.08" : "110.11 243.11 803.48 553.28"
  return (
    <svg className={`site-logo-svg ${className ?? ""}`.trim()} viewBox={viewBox} role="img" aria-label="Oliver Street Creative">
      {block ? (
        <g transform="matrix(1.46961,0,0,1.40381,-23.3218,58.0646)">
          <rect className="lg-block" x="77.616" y="105.48" width="573.09" height="436.015" />
        </g>
      ) : null}
      <g transform="matrix(1.7074,0,0,1.43848,-59.2185,16.4579)">
        <text className="lg-caps" x="142.378" y="266.712" fontSize="154.165">
          OLIVER
        </text>
      </g>
      <g transform="matrix(1.08063,0,0,1.01192,93.765,-60.6306)">
        <text className="lg-caps" x="83.222" y="646.781" fontSize="227.894">
          S<tspan x="180.077">T</tspan>REET
        </text>
      </g>
      <g transform="matrix(1.1399,0,0,1.13435,-71.3719,-73.4115)">
        <rect className="lg-band" x="159.207" y="622.775" width="704.874" height="144.009" />
      </g>
      <g className="lg-script" transform="matrix(1.13661,0,0,1,32.8455,3.44745)">
        <text x="119.689" y="780.901" fontSize="191.251">
          C
        </text>
        <g transform="matrix(191.251,0,0,191.251,649.807,780.901)">
          <path d="M0.141,0.006C0.092,0.006 0.054,-0.007 0.027,-0.033C-0,-0.058 -0.014,-0.098 -0.014,-0.153C-0.014,-0.199 -0.005,-0.25 0.013,-0.305C0.031,-0.36 0.06,-0.408 0.101,-0.449C0.142,-0.489 0.193,-0.509 0.256,-0.509C0.329,-0.509 0.366,-0.477 0.366,-0.413C0.366,-0.376 0.355,-0.341 0.334,-0.31C0.313,-0.279 0.284,-0.254 0.249,-0.235C0.214,-0.216 0.176,-0.205 0.136,-0.202C0.135,-0.187 0.134,-0.177 0.134,-0.172C0.134,-0.117 0.155,-0.089 0.196,-0.089C0.215,-0.089 0.235,-0.094 0.256,-0.104C0.277,-0.114 0.297,-0.127 0.314,-0.142C0.296,-0.043 0.238,0.006 0.141,0.006ZM0.143,-0.25C0.168,-0.251 0.192,-0.259 0.215,-0.275C0.237,-0.291 0.255,-0.312 0.269,-0.337C0.282,-0.362 0.289,-0.388 0.289,-0.415C0.289,-0.442 0.281,-0.456 0.264,-0.456C0.241,-0.456 0.218,-0.435 0.195,-0.393C0.171,-0.35 0.154,-0.303 0.143,-0.25Z" />
        </g>
        <text x="222.552" y="780.901" fontSize="191.251">
          reativ
        </text>
      </g>
    </svg>
  )
}

/** Every option, one shown at a time by html[data-logo] (site.css). Hidden ones are display:none, out of the a11y
 *  tree; the link around them carries the name. */
export function LogoOptionsMark() {
  return (
    <>
      <span className="site-logo-opt" data-opt="a">
        <StackedLogo className="site-logo-a" />
      </span>
      <span className="site-logo-opt site-mk site-mk-b" data-opt="b">
        <b>Oliver Street</b>
        <i>Creative</i>
      </span>
      <span className="site-logo-opt site-mk site-mk-c" data-opt="c">
        <b>Oliver Street</b>
        <i>Creative</i>
      </span>
      {(["d76", "d83", "d90"] as const).map((k) => (
        <span key={k} className="site-logo-opt site-mk site-mk-d" data-opt={k}>
          <b>Oliver Street</b>
          <i>
            C<span style={{ fontSize: `${D_SIZES[k]}px` }}>reative</span>
          </i>
        </span>
      ))}
      <span className="site-logo-opt" data-opt="now">
        <Wordmark />
      </span>
    </>
  )
}

/** The staging-only toggle, bottom right (client-website's Comment button holds bottom left): a small pill that opens
 *  upward. Plain links in a <details>, so it works without the script too. */
export function LogoSwitch() {
  return (
    <details className="site-logo-switch">
      <summary aria-label="Header logo options (staging only)">
        Logo
        {LOGO_OPTIONS.map((o) => (
          <span key={o.key} className="site-logo-cur" data-opt={o.key}>
            {o.label}
          </span>
        ))}
      </summary>
      <nav aria-label="Header logo options">
        {LOGO_OPTIONS.map((o) => (
          <a key={o.key} href={`?logo=${o.key}`} data-opt={o.key}>
            {o.long}
          </a>
        ))}
      </nav>
    </details>
  )
}
