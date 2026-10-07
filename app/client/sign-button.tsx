// "Read and sign": a plain form POST, so it works with no client JS and is
// refused by middleware while staff are viewing as a client (read-only).
// Sign Here contract v2: the ENGINE picks the template (a client never chooses paid or unpaid), so only the item goes.
// A staging preview sign-in (the screenshot camera) sees the real button, switched off; the route refuses it too.
// SPEC §30 v2: it carries the org whose paper it is (a project page can show another of the person's orgs); the route
// accepts only one of their own.
export function SignButton({ job, itemId, org, disabled, preview }: { job: string; itemId: string; org: string; disabled?: boolean; preview?: boolean }) {
  if (disabled) return <span className="cs-status">Not ready to sign yet</span>
  return (
    <form action="/client/sign/start" method="post">
      <input type="hidden" name="org" value={org} />
      <input type="hidden" name="job" value={job} />
      <input type="hidden" name="item" value={itemId} />
      <button className="cs-btn" disabled={preview}>Read and sign</button>
      {preview ? <small style={{ display: "block", marginTop: 6 }}>Preview sign-in: the button is off.</small> : null}
    </form>
  )
}
