import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { db } from "@/lib/db";
import { fileUploads } from "@/lib/schema";
import { requireAuth, type SessionUser } from "@/lib/auth";
import { errorResponse, jsonResponse, optionsResponse } from "@/lib/cors";
import { desc } from "drizzle-orm";

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");
const USE_DB_STORAGE = process.env.NODE_ENV === "production" || process.env.FILE_STORAGE === "db";

export async function OPTIONS() {
  return optionsResponse();
}

export async function POST(request: Request) {
  const session = await requireAuth(request);
  if (session instanceof Response) return session;
  const user = session as SessionUser;

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  if (!file) return errorResponse("الملف مطلوب", 400);

  const maxSize = 10 * 1024 * 1024;
  if (file.size > maxSize) return errorResponse("حجم الملف يتجاوز 10 ميجابايت", 400);

  const buffer = Buffer.from(await file.arrayBuffer());
  const mimeType = file.type || "application/octet-stream";

  if (USE_DB_STORAGE) {
    await db.insert(fileUploads).values({
      filename: file.name,
      mimeType,
      size: file.size,
      data: buffer,
      createdById: user.id,
    });
    const [created] = await db.select({ id: fileUploads.id }).from(fileUploads).orderBy(desc(fileUploads.id)).limit(1);
    const url = `/api/files/${created!.id}`;
    return jsonResponse({ url, filename: file.name, size: file.size });
  }

  await mkdir(UPLOAD_DIR, { recursive: true });
  const ext = path.extname(file.name) || ".bin";
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;
  const filepath = path.join(UPLOAD_DIR, filename);
  await writeFile(filepath, buffer);

  const url = `/uploads/${filename}`;
  return jsonResponse({ url, filename: file.name, size: file.size });
}
