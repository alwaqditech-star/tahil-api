import { db } from "@/lib/db";
import { users } from "@/lib/schema";
import { requireAuth, type SessionUser } from "@/lib/auth";
import { errorResponse, jsonResponse, optionsResponse } from "@/lib/cors";
import { eq } from "drizzle-orm";

export async function OPTIONS() {
  return optionsResponse();
}

/** قائمة المستخدمين القابلين للإسناد — للإدارة ومدير المشروع */
export async function GET(request: Request) {
  const session = await requireAuth(request);
  if (session instanceof Response) return session;
  const user = session as SessionUser;
  if (user.role !== "admin" && user.role !== "project_manager" && user.role !== "accountant") {
    return errorResponse("ليس لديك صلاحية", 403);
  }

  const rows = await db.select({
    id: users.id, name: users.name, role: users.role, isActive: users.isActive,
  }).from(users).where(eq(users.isActive, true));

  return jsonResponse(rows);
}
