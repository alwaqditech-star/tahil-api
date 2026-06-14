import { db } from "@/lib/db";
import { contractors } from "@/lib/schema";
import { requireAuth, requireRole, type SessionUser } from "@/lib/auth";
import { errorResponse, jsonResponse, optionsResponse, emptyResponse } from "@/lib/cors";
import { eq } from "drizzle-orm";

function mapContractor(c: typeof contractors.$inferSelect) {
  return {
    id: c.id, name: c.name, companyName: c.companyName, phone: c.phone,
    email: c.email, specialty: c.specialty, licenseNumber: c.licenseNumber,
    vatNumber: c.vatNumber, address: c.address, status: c.status, notes: c.notes,
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

  await db.update(contractors).set({
    name: body.name, companyName: body.companyName, phone: body.phone,
    email: body.email, specialty: body.specialty, licenseNumber: body.licenseNumber,
    vatNumber: body.vatNumber, address: body.address, status: body.status, notes: body.notes,
    updatedAt: new Date(),
  }).where(eq(contractors.id, parseInt(id)));

  const [row] = await db.select().from(contractors).where(eq(contractors.id, parseInt(id)));
  if (!row) return errorResponse("غير موجود", 404);
  return jsonResponse(mapContractor(row));
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAuth(request);
  if (session instanceof Response) return session;
  const user = session as SessionUser;
  if (!requireRole(user, "admin")) return errorResponse("ليس لديك صلاحية", 403);

  const { id } = await params;
  await db.delete(contractors).where(eq(contractors.id, parseInt(id)));
  return emptyResponse();
}
