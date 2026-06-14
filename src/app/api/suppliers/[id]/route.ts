import { db } from "@/lib/db";
import { suppliers } from "@/lib/schema";
import { requireAuth, requireRole, type SessionUser } from "@/lib/auth";
import { errorResponse, jsonResponse, optionsResponse, emptyResponse } from "@/lib/cors";
import { eq } from "drizzle-orm";

function mapSupplier(s: typeof suppliers.$inferSelect) {
  return {
    id: s.id, name: s.name, companyName: s.companyName, phone: s.phone,
    email: s.email, category: s.category, vatNumber: s.vatNumber,
    address: s.address, status: s.status, notes: s.notes,
  };
}

export async function OPTIONS() {
  return optionsResponse();
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAuth(request);
  if (session instanceof Response) return session;
  const user = session as SessionUser;
  if (!requireRole(user, "admin", "project_manager")) return errorResponse("ليس لديك صلاحية", 403);

  const { id } = await params;
  const body = await request.json();

  await db.update(suppliers).set({
    name: body.name, companyName: body.companyName, phone: body.phone,
    email: body.email, category: body.category, vatNumber: body.vatNumber,
    address: body.address, status: body.status, notes: body.notes,
    updatedAt: new Date(),
  }).where(eq(suppliers.id, parseInt(id)));

  const [row] = await db.select().from(suppliers).where(eq(suppliers.id, parseInt(id)));
  if (!row) return errorResponse("غير موجود", 404);
  return jsonResponse(mapSupplier(row));
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAuth(request);
  if (session instanceof Response) return session;
  const user = session as SessionUser;
  if (!requireRole(user, "admin")) return errorResponse("ليس لديك صلاحية", 403);

  const { id } = await params;
  await db.delete(suppliers).where(eq(suppliers.id, parseInt(id)));
  return emptyResponse();
}
