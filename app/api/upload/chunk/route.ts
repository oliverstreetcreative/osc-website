import { NextRequest, NextResponse } from "next/server";
import { appendDropboxChunk, getDropboxAccessToken } from "../../../../lib/upload";

export async function POST(req: NextRequest) {
  try {
    const userId = req.headers.get("x-user-id");
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const metaHeader = req.headers.get("x-upload-meta");
    if (!metaHeader) {
      return NextResponse.json({ error: "X-Upload-Meta header missing" }, { status: 400 });
    }

    let meta: { upload_id: string; session_id: string; offset: number };
    try {
      meta = JSON.parse(Buffer.from(metaHeader, "base64").toString("utf-8"));
    } catch {
      return NextResponse.json({ error: "Invalid X-Upload-Meta" }, { status: 400 });
    }

    const { session_id, offset } = meta;
    if (!session_id || typeof offset !== "number") {
      return NextResponse.json({ error: "Invalid upload meta fields" }, { status: 400 });
    }

    const arrayBuffer = await req.arrayBuffer();
    const chunk = new Uint8Array(arrayBuffer);

    const token = await getDropboxAccessToken();
    if (!token) {
      return NextResponse.json({ error: "Upload service unavailable" }, { status: 503 });
    }

    await appendDropboxChunk(token, session_id, offset, chunk);

    return new NextResponse(null, { status: 204 });
  } catch (err) {
    console.error("upload/chunk error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
