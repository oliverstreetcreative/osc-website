import { NextRequest, NextResponse } from "next/server";
import {
  sanitizeFilename,
  verifyProjectAccess,
  startDropboxSession,
  getDropboxAccessToken,
} from "../../../../lib/upload";
import { isImpersonating } from "@/lib/auth/impersonation";

export async function POST(req: NextRequest) {
  try {
    // Impersonation check — read-only mode
    if (await isImpersonating()) {
      return NextResponse.json(
        { error: "Impersonation mode is read-only. Stop impersonating to take actions." },
        { status: 403 },
      );
    }

    const userId = req.headers.get("x-user-id");
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let body: { filename?: unknown; size?: unknown; project_id?: unknown; upload_context?: unknown };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const { filename, size, project_id, upload_context } = body;

    if (typeof filename !== "string" || !filename.trim()) {
      return NextResponse.json({ error: "filename is required" }, { status: 400 });
    }
    if (typeof size !== "number" || size <= 0) {
      return NextResponse.json({ error: "size must be a positive number" }, { status: 400 });
    }
    if (typeof project_id !== "string" || !project_id.trim()) {
      return NextResponse.json({ error: "project_id is required" }, { status: 400 });
    }

    const sanitizedFilename = sanitizeFilename(filename);

    const { allowed } = await verifyProjectAccess(userId, project_id);
    if (!allowed) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const token = await getDropboxAccessToken();
    if (!token) {
      return NextResponse.json({ error: "Upload service unavailable" }, { status: 503 });
    }

    const session_id = await startDropboxSession(token);
    const upload_id = crypto.randomUUID();

    return NextResponse.json({
      upload_id,
      session_id,
      chunk_size: 8388608,
      filename: sanitizedFilename,
      project_id,
    });
  } catch (err) {
    console.error("upload/initiate error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
