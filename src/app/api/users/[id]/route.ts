import { db } from "@/lib/db";
import { users } from "@/lib/schema";
import { requireAuth, requireRole, hashPassword, type SessionUser } from "@/lib/auth";
import { errorResponse, jsonResponse, optionsResponse, emptyResponse } from "@/lib/cors";
import { eq } from "drizzle-orm";

function mapUser(u: typeof users.$inferSelect) {
  return {
    id: u.id, name: u.name, email: u.email, username: u.username,
    role: u.role, department: u.department, assignedProjectId: u.assignedProjectId,
    isActive: u.isActive,
  };
}

export async function OPTIONS() {
  return optionsResponse();
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAuth(request);
  if (session instanceof Response) return session;
  const user = session as SessionUser;
  if (!requireRole(user, "admin")) return errorResponse("ليس لديك صلاحية", 403);

  const { id } = await params;
  const body = await request.json();
  const update: Record<string, unknown> = {
    name: body.name, email: body.email, username: body.username,
    role: body.role, department: body.department,
    assignedProjectId: body.assignedProjectId, isActive: body.isActive,
  };
  if (body.password) update.passwordHash = await hashPassword(body.password);

  await db.update(users).set(update).where(eq(users.id, parseInt(id)));

  const [row] = await db.select().from(users).where(eq(users.id, parseInt(id)));
  if (!row) return errorResponse("غير موجود", 404);
  return jsonResponse(mapUser(row));
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAuth(request);
  if (session instanceof Response) return session;
  const user = session as SessionUser;
  if (!requireRole(user, "admin")) return errorResponse("ليس لديك صلاحية", 403);

  const { id } = await params;
  if (parseInt(id) === user.id) return errorResponse("لا يمكن حذف حسابك", 400);
  await db.delete(users).where(eq(users.id, parseInt(id)));
  return emptyResponse();
}
