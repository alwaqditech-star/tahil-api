import { db } from "@/lib/db";
import { users } from "@/lib/schema";
import { requireAuth, requireRole, hashPassword, type SessionUser } from "@/lib/auth";
import { errorResponse, jsonResponse, optionsResponse } from "@/lib/cors";
import { desc } from "drizzle-orm";

function mapUser(u: typeof users.$inferSelect) {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    username: u.username,
    role: u.role,
    department: u.department,
    assignedProjectId: u.assignedProjectId,
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
  return jsonResponse(rows.map(mapUser));
}

export async function POST(request: Request) {
  const session = await requireAuth(request);
  if (session instanceof Response) return session;
  const user = session as SessionUser;
  if (!requireRole(user, "admin")) return errorResponse("ليس لديك صلاحية", 403);

  const body = await request.json();
  const passwordHash = body.password ? await hashPassword(body.password) : null;

  await db.insert(users).values({
    name: body.name,
    email: body.email,
    username: body.username,
    passwordHash,
    role: body.role ?? "project_manager",
    department: body.department,
    assignedProjectId: body.assignedProjectId,
    isActive: body.isActive ?? true,
  });

  const [created] = await db.select().from(users).orderBy(desc(users.id)).limit(1);
  return jsonResponse(mapUser(created!), 201);
}
