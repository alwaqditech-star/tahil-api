import { db } from "@/lib/db";
import { users } from "@/lib/schema";
import { requireAuth, requireRole, hashPassword, type SessionUser } from "@/lib/auth";
import { errorResponse, jsonResponse, optionsResponse, emptyResponse } from "@/lib/cors";
import { getAssignedProjectIdsByUserIds, ProjectAssignmentConflictError } from "@/lib/user-projects";
import { applyProjectLinks } from "@/lib/user-project-links";
import { eq } from "drizzle-orm";

function mapUser(
  u: typeof users.$inferSelect,
  assignedProjectIds: number[] = [],
) {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    username: u.username,
    role: u.role,
    department: u.department,
    assignedProjectId: u.assignedProjectId,
    assignedProjectIds: u.role === "project_manager" ? assignedProjectIds : [],
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
  const userId = parseInt(id);
  const body = await request.json();
  const role = body.role ?? "project_manager";

  const update: Record<string, unknown> = {
    name: body.name,
    email: body.email,
    username: body.username,
    role,
    department: body.department,
    isActive: body.isActive,
  };
  if (body.password) update.passwordHash = await hashPassword(body.password);

  await db.update(users).set(update).where(eq(users.id, userId));

  try {
    await applyProjectLinks(userId, role, body.assignedProjectId, body.assignedProjectIds);
  } catch (err) {
    if (err instanceof ProjectAssignmentConflictError) return errorResponse(err.message, 409);
    throw err;
  }

  const [row] = await db.select().from(users).where(eq(users.id, userId));
  if (!row) return errorResponse("غير موجود", 404);

  const assignedProjectIds = row.role === "project_manager"
    ? (await getAssignedProjectIdsByUserIds([userId])).get(userId) ?? []
    : [];

  return jsonResponse(mapUser(row, assignedProjectIds));
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
