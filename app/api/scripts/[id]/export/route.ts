// GET /api/scripts/<id>/export?format=txt|docx: the script as a file (SPEC §14 phone moment 7): the Prompter .txt
// (AUDIO only, exactly what the prompter reads) or a Word file (VIDEO | AUDIO table) for a client who insists. Both are
// the BASE text: pending suggestions are never exported (v4 #7). PDF = the print view (/client/scripts/<id>/print).
// File names carry the spot, the time and the date.
import { NextResponse } from "next/server"
import { AlignmentType, Document, Packer, Paragraph, Table, TableCell, TableRow, TextRun, WidthType } from "docx"
import { db } from "@/lib/db"
import { roleOf, sessionFacts } from "@/lib/scripts/server/access"
import { catchUp, withLive } from "@/lib/scripts/server/registry"
import { pmFromYDoc, renderScript } from "@/lib/scripts/doc"
import { clock } from "@/lib/scripts/timing"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const safe = (s: string) => s.replace(/[\\/:*?"<>|\u0000-\u001f]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 80) || "Script"

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const facts = await sessionFacts()
  if (!facts) return NextResponse.json({ error: "Sign in" }, { status: 401 })
  if (!(await roleOf(params.id, facts))) return NextResponse.json({ error: "Not found" }, { status: 404 })
  const format = new URL(req.url).searchParams.get("format") ?? "txt"
  const script = await db.script.findUnique({ where: { id: params.id }, select: { title: true, job: true, pace_wpm: true, target_seconds: true, reader: true } })
  if (!script) return NextResponse.json({ error: "Not found" }, { status: 404 })
  const doc = await withLive(params.id, async (l) => {
    await catchUp(l)
    return pmFromYDoc(l.doc)
  })
  const r = renderScript(doc, { wpm: script.pace_wpm, target_s: script.target_seconds })
  const stamp = new Date().toISOString().slice(0, 10)
  const base = `${safe(script.title)} ${clock(r.total_s).replace(":", "m")}s ${stamp}`

  if (format === "txt") {
    return new NextResponse(r.prompter_text, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(`PROMPTER ${base}.txt`)}`,
        "Cache-Control": "no-store",
      },
    })
  }
  if (format === "docx") {
    const cell = (lines: string[], muted = false) =>
      new TableCell({
        width: { size: muted ? 40 : 60, type: WidthType.PERCENTAGE },
        children: (lines.length ? lines : [""]).map((t) => new Paragraph({ children: [new TextRun({ text: t, color: muted ? "666666" : undefined })] })),
      })
    const header = new TableRow({
      tableHeader: true,
      children: ["VIDEO", "AUDIO"].map((h) => new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: h, bold: true, size: 18 })] })] })),
    })
    const rows = r.rows.map(
      (row) =>
        new TableRow({
          children: [
            cell(row.video, true),
            cell([
              ...(row.speaker ? [`${row.speaker}:`] : []),
              ...row.audio,
              ...row.directions.map((d) => `(${d})`),
            ]),
          ],
        }),
    )
    const file = new Document({
      creator: "Oliver Street Creative",
      title: script.title,
      sections: [
        {
          children: [
            new Paragraph({ children: [new TextRun({ text: script.title, bold: true, size: 32 })] }),
            new Paragraph({
              children: [new TextRun({ text: [script.job, script.reader ? `read by ${script.reader}` : null, r.label].filter(Boolean).join(" · "), color: "666666" })],
            }),
            new Paragraph({ children: [] }),
            new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [header, ...rows] }),
            ...(r.pending_suggestions
              ? [new Paragraph({ alignment: AlignmentType.LEFT, children: [new TextRun({ text: `${r.pending_suggestions} pending suggestion(s) not included.`, italics: true, color: "666666" })] })]
              : []),
          ],
        },
      ],
    })
    const buf = await Packer.toBuffer(file)
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(`${base}.docx`)}`,
        "Cache-Control": "no-store",
      },
    })
  }
  return NextResponse.json({ error: "Ask for txt or docx; PDF is the print view." }, { status: 400 })
}
