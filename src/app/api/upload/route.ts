import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { requireAuth } from "@/lib/auth";
import { errorResponse, jsonResponse, optionsResponse } from "@/lib/cors";

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");

export async function OPTIONS() {
  return optionsResponse();
}

export async function POST(request: Request) {
  const session = await requireAuth(request);
  if (session instanceof Response) return session;

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  if (!file) return errorResponse("الملف مطلوب", 400);

  const maxSize = 10 * 1024 * 1024;
  if (file.size > maxSize) return errorResponse("حجم الملف يتجاوز 10 ميجابايت", 400);

  await mkdir(UPLOAD_DIR, { recursive: true });
  const ext = path.extname(file.name) || ".bin";
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;
  const filepath = path.join(UPLOAD_DIR, filename);
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(filepath, buffer);

  const url = `/uploads/${filename}`;
  return jsonResponse({ url, filename: file.name, size: file.size });
}
