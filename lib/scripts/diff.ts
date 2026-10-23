// What changed between two versions' text (SPEC §14 phone moment 5), word by word. Server and browser; no deps.
// Words and the spaces between them are the tokens; the longest common subsequence decides what stayed.
export type DiffPart = { op: "=" | "+" | "-"; text: string }

const tokens = (s: string) => s.match(/\s+|[^\s]+/g) ?? []
const MAX_CELLS = 4_000_000 // ~2,000 × 2,000 tokens; beyond that, fall back to "everything changed"

export function wordDiff(before: string, after: string): DiffPart[] {
  const a = tokens(before)
  const b = tokens(after)
  // trim the common head and tail first: most edits are small
  let head = 0
  while (head < a.length && head < b.length && a[head] === b[head]) head++
  let tail = 0
  while (tail < a.length - head && tail < b.length - head && a[a.length - 1 - tail] === b[b.length - 1 - tail]) tail++
  const A = a.slice(head, a.length - tail)
  const B = b.slice(head, b.length - tail)
  const out: DiffPart[] = []
  const push = (op: DiffPart["op"], text: string) => {
    if (!text) return
    const last = out[out.length - 1]
    if (last && last.op === op) last.text += text
    else out.push({ op, text })
  }
  push("=", a.slice(0, head).join(""))
  if ((A.length + 1) * (B.length + 1) > MAX_CELLS) {
    push("-", A.join(""))
    push("+", B.join(""))
  } else {
    // lengths of the LCS of A[i:] and B[j:]
    const w = B.length + 1
    const L = new Uint32Array((A.length + 1) * w)
    for (let i = A.length - 1; i >= 0; i--) {
      for (let j = B.length - 1; j >= 0; j--) {
        L[i * w + j] = A[i] === B[j] ? L[(i + 1) * w + j + 1] + 1 : Math.max(L[(i + 1) * w + j], L[i * w + j + 1])
      }
    }
    let i = 0
    let j = 0
    while (i < A.length && j < B.length) {
      if (A[i] === B[j]) {
        push("=", A[i])
        i++
        j++
      } else if (L[(i + 1) * w + j] >= L[i * w + j + 1]) push("-", A[i++])
      else push("+", B[j++])
    }
    while (i < A.length) push("-", A[i++])
    while (j < B.length) push("+", B[j++])
  }
  push("=", a.slice(a.length - tail).join(""))
  return out
}

/** Rebuild either side from a diff (tests, and a sanity check). */
export const sideOf = (d: DiffPart[], side: "before" | "after") => d.filter((p) => p.op === "=" || p.op === (side === "before" ? "-" : "+")).map((p) => p.text).join("")
