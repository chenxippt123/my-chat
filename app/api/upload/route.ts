import { NextResponse } from "next/server";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { getSessionUserId } from "@/lib/session";
import { jsonError } from "@/lib/http";

const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "application/pdf",
  "text/plain",
]);

function sanitizeBaseName(name: string): string {
  const base = path.basename(name).replace(/[^a-zA-Z0-9._-]/g, "_");
  return base.slice(0, 120) || "file";
}

export async function POST(req: Request) {
  const userId = await getSessionUserId();
  if (!userId) {
    return jsonError("Unauthorized", 401);
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return jsonError("Invalid form data", 400);
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return jsonError("Missing file", 400);
  }

  if (file.size > MAX_BYTES) {
    return jsonError("File too large (max 10MB)", 413);
  }

  const mime = file.type || "application/octet-stream";
  if (!ALLOWED.has(mime)) {
    return jsonError("File type not allowed", 415);
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const safeName = sanitizeBaseName(file.name);
  const id = randomUUID();
  const filename = `${id}-${safeName}`;
  const uploadDir = path.join(process.cwd(), "public", "uploads");
  await mkdir(uploadDir, { recursive: true });
  const diskPath = path.join(uploadDir, filename);
  await writeFile(diskPath, buf);

  const url = `/uploads/${filename}`;

  return NextResponse.json({
    url,
    mime,
    name: file.name,
  });
}
