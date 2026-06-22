import { db } from "@/lib/db";
import { fileUploads } from "@/lib/schema";
import { getTokenFromRequest, verifyToken } from "@/lib/auth";
import { errorResponse, optionsResponse, pickOrigin } from "@/lib/cors";
import { eq } from "drizzle-orm";

export async function OPTIONS() {
  return optionsResponse();
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const token = await getTokenFromRequest(request);
  if (!token) return errorResponse("غير مصرح بالدخول", 401);
  const payload = await verifyToken(token);
  if (!payload?.userId) return errorResponse("غير مصرح بالدخول", 401);

  const { id } = await params;
  const fileId = parseInt(id, 10);
  if (!fileId) return errorResponse("معرّف الملف غير صالح", 400);

  const [row] = await db.select().from(fileUploads).where(eq(fileUploads.id, fileId));
  if (!row) return errorResponse("الملف غير موجود", 404);

  const origin = request.headers.get("origin");
  const cors = {
    "Access-Control-Allow-Origin": pickOrigin(origin),
    "Access-Control-Allow-Credentials": "true",
    "Cache-Control": "private, max-age=3600",
    "Content-Type": row.mimeType,
    "Content-Length": String(row.size),
    "Content-Disposition": `inline; filename="${encodeURIComponent(row.filename)}"`,
  };

  return new Response(new Uint8Array(row.data), { status: 200, headers: cors });
}
