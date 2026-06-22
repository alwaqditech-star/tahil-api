import { db } from "@/lib/db";
import { users } from "@/lib/schema";
import { requireAuth, requireRole, hashPassword, type SessionUser } from "@/lib/auth";
import { errorResponse, jsonResponse, optionsResponse } from "@/lib/cors";
import { getAssignedProjectIdsByUserIds } from "@/lib/user-projects";
import { applyProjectLinks } from "@/lib/user-project-links";
import { desc, eq } from "drizzle-orm";

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
    createdAt: u.createdAt,
  };
}

export async function OPTIONS() {
  return optionsResponse();
}

export async function GET(request: Request) {
  const session = await requireAuth(request);
  if (session instanceof Response) return session;
  const user = session as SessionUser;
  if (!requireRole(user, "admin")) return errorResponse("ليس لديك صلاحية", 403);

  const rows = await db.select().from(users).orderBy(desc(users.createdAt));
  const managerIds = rows.filter((u) => u.role === "project_manager").map((u) => u.id);
  const assignments = await getAssignedProjectIdsByUserIds(managerIds);

  return jsonResponse(rows.map((u) => mapUser(u, assignments.get(u.id) ?? [])));
}

export async function POST(request: Request) {
  const session = await requireAuth(request);
  if (session instanceof Response) return session;
  const user = session as SessionUser;
  if (!requireRole(user, "admin")) return errorResponse("ليس لديك صلاحية", 403);

  const body = await request.json();
  const passwordHash = body.password ? await hashPassword(body.password) : null;
  const role = body.role ?? "project_manager";

  const initialProjectId =
    role === "site_supervisor" || role === "project_engineer"
      ? (body.assignedProjectId ? Number(body.assignedProjectId) : null)
      : null;

  await db.insert(users).values({
    name: body.name,
    email: body.email,
    username: body.username,
    passwordHash,
    role,
    department: body.department,
    assignedProjectId: initialProjectId,
    isActive: body.isActive ?? true,
  });

  const [created] = await db.select().from(users).orderBy(desc(users.id)).limit(1);
  if (!created) return errorResponse("فشل الإنشاء", 500);

  await applyProjectLinks(
    created.id,
    role,
    body.assignedProjectId,
    body.assignedProjectIds,
  );

  const [updated] = await db.select().from(users).where(eq(users.id, created.id));
  const assignedProjectIds = role === "project_manager"
    ? (await getAssignedProjectIdsByUserIds([created.id])).get(created.id) ?? []
    : [];

  return jsonResponse(mapUser(updated!, assignedProjectIds), 201);
}
