// "Read and sign": a plain form POST, so it works with no client JS and is
// refused by middleware while staff are viewing as a client (read-only).
// Sign Here contract v2: the ENGINE picks the template (a client never chooses paid or unpaid), so only the item goes.
export function SignButton({ job, itemId, disabled }: { job: string; itemId: string; disabled?: boolean }) {
  if (disabled) return <span className="cs-status">Not ready to sign yet</span>
  return (
    <form action="/client/sign/start" method="post">
      <input type="hidden" name="job" value={job} />
      <input type="hidden" name="item" value={itemId} />
      <button className="cs-btn">Read and sign</button>
    </form>
  )
}
