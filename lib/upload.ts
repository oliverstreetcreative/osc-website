import { db } from "./db";
import { getDropboxAccessToken } from "./dropbox-auth";

export { getDropboxAccessToken };

export function sanitizeFilename(name: string): string {
  let s = name.replace(/[/\\:*?"<>|]/g, "_");
  s = s.replace(/\s+/g, " ").trim();
  s = s.replace(/^[.\s]+|[.\s]+$/g, "");
  s = s.slice(0, 255);
  return s || "upload";
}

export async function verifyProjectAccess(
  userId: string,
  projectId: string
): Promise<{
  allowed: boolean;
  project: { id: string; job_number: string | null; name: string } | null;
}> {
  const project = await db.project.findUnique({
    where: { id: projectId },
    select: { id: true, job_number: true, name: true, client_portal_enabled: true },
  });

  if (!project) return { allowed: false, project: null };
  if (!project.client_portal_enabled) return { allowed: false, project: null };

  const person = await db.person.findUnique({
    where: { id: userId },
    select: { is_staff: true, portal_allowed: true },
  });

  if (!person?.portal_allowed) return { allowed: false, project: null };
  if (person.is_staff) return { allowed: true, project };

  const [contact, participant] = await Promise.all([
    db.projectContact.findFirst({
      where: { project_id: projectId, person_id: userId },
      select: { id: true },
    }),
    db.projectParticipant.findFirst({
      where: { project_id: projectId, person_id: userId },
      select: { id: true },
    }),
  ]);

  if (contact || participant) return { allowed: true, project };

  return { allowed: false, project: null };
}

export async function startDropboxSession(token: string): Promise<string> {
  const res = await fetch(
    "https://content.dropboxapi.com/2/files/upload_session/start",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/octet-stream",
        "Dropbox-API-Arg": JSON.stringify({ close: false }),
      },
      body: "",
    }
  );
  if (!res.ok) {
    throw new Error(`Dropbox session start failed: ${res.status} ${await res.text()}`);
  }
  const data = (await res.json()) as { session_id: string };
  return data.session_id;
}

export async function appendDropboxChunk(
  token: string,
  sessionId: string,
  offset: number,
  chunk: Uint8Array
): Promise<void> {
  const arg = JSON.stringify({ cursor: { session_id: sessionId, offset }, close: false });
  const res = await fetch(
    "https://content.dropboxapi.com/2/files/upload_session/append_v2",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/octet-stream",
        "Dropbox-API-Arg": arg,
      },
      body: chunk as unknown as BodyInit,
    }
  );
  if (!res.ok) {
    throw new Error(`Dropbox append failed: ${res.status} ${await res.text()}`);
  }
}

export async function finishDropboxSession(
  token: string,
  sessionId: string,
  offset: number,
  destPath: string
): Promise<{ path_display: string }> {
  const arg = JSON.stringify({
    cursor: { session_id: sessionId, offset },
    commit: { path: destPath, mode: "add", autorename: true },
  });
  const res = await fetch(
    "https://content.dropboxapi.com/2/files/upload_session/finish",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/octet-stream",
        "Dropbox-API-Arg": arg,
      },
      body: "",
    }
  );
  if (!res.ok) {
    throw new Error(`Dropbox finish failed: ${res.status} ${await res.text()}`);
  }
  return (await res.json()) as { path_display: string };
}
