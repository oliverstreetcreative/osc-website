import { NextRequest, NextResponse } from "next/server";
import { db } from "../../../../lib/db";
import {
  verifyProjectAccess,
  finishDropboxSession,
  getDropboxAccessToken,
} from "../../../../lib/upload";

function uploadContextToFolder(uploadContext?: string): string {
  if (!uploadContext) return "Uploads";

  const ctx = uploadContext.toLowerCase();
  if (ctx.includes("invoice")) return "Invoices";
  if (ctx.includes("contract")) return "Contracts";
  if (ctx.includes("asset")) return "Assets";
  if (ctx.includes("brief")) return "Briefs";
  if (ctx.includes("review")) return "Reviews";

  // Use the raw context string (after the colon if prefixed like "sam_request:invoice")
  const colonIdx = uploadContext.indexOf(":");
  return colonIdx !== -1 ? uploadContext.slice(colonIdx + 1) : uploadContext;
}

export async function POST(req: NextRequest) {
  try {
    const userId = req.headers.get("x-user-id");
    const userEmail = req.headers.get("x-user-email") ?? "unknown";
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let body: {
      upload_id?: unknown;
      session_id?: unknown;
      project_id?: unknown;
      filename?: unknown;
      file_size?: unknown;
      upload_context?: unknown;
      mime_type?: unknown;
    };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const { upload_id, session_id, project_id, filename, file_size, upload_context, mime_type } = body;

    if (typeof upload_id !== "string" || !upload_id.trim()) {
      return NextResponse.json({ error: "upload_id is required" }, { status: 400 });
    }
    if (typeof session_id !== "string" || !session_id.trim()) {
      return NextResponse.json({ error: "session_id is required" }, { status: 400 });
    }
    if (typeof project_id !== "string" || !project_id.trim()) {
      return NextResponse.json({ error: "project_id is required" }, { status: 400 });
    }
    if (typeof filename !== "string" || !filename.trim()) {
      return NextResponse.json({ error: "filename is required" }, { status: 400 });
    }
    if (typeof file_size !== "number" || file_size < 0) {
      return NextResponse.json({ error: "file_size must be a non-negative number" }, { status: 400 });
    }

    const { allowed, project } = await verifyProjectAccess(userId, project_id);
    if (!allowed || !project) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const token = await getDropboxAccessToken();
    if (!token) {
      return NextResponse.json({ error: "Upload service unavailable" }, { status: 503 });
    }

    const folder = uploadContextToFolder(typeof upload_context === "string" ? upload_context : undefined);
    const basePath = project.job_number
      ? `/Clients/${project.job_number}/${folder}/${filename}`
      : `/Clients/${project.name}/${folder}/${filename}`;

    const result = await finishDropboxSession(token, session_id, file_size, basePath);

    const now = new Date();

    await db.portalUpload.create({
      data: {
        id: crypto.randomUUID(),
        project_id,
        uploader_id: userId,
        file_name: filename,
        file_path: result.path_display,
        file_size_bytes: BigInt(file_size),
        mime_type: typeof mime_type === "string" ? mime_type : null,
        uploaded_at: now,
        source_bible_id: 0,
        source_bible_table: "portal_uploads",
        published_at: now,
        publication_version: 1,
      },
    });

    await db.portalEvent.create({
      data: {
        id: crypto.randomUUID(),
        project_id,
        person_id: userId,
        event_type: "upload_completed",
        summary: `${filename} uploaded by ${userEmail}`,
        details: {
          upload_id,
          file_size,
          upload_context: upload_context ?? null,
          dropbox_path: result.path_display,
        },
        occurred_at: now,
        source: "portal_client",
      },
    });

    return NextResponse.json({
      success: true,
      dropbox_path: result.path_display,
      upload_id,
    });
  } catch (err) {
    console.error("upload/finish error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
