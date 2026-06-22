import { db } from "./db";
import { users } from "./schema";
import { syncProjectAssignments } from "./user-projects";
import { eq } from "drizzle-orm";

export async function applyProjectLinks(
  userId: number,
  role: string,
  assignedProjectId: number | null | undefined,
  assignedProjectIds: number[] | undefined,
) {
  if (role === "project_manager") {
    const ids = Array.isArray(assignedProjectIds)
      ? assignedProjectIds.map((v) => Number(v)).filter((n) => n > 0)
      : [];
    await syncProjectAssignments(userId, ids);
    await db.update(users).set({ assignedProjectId: null }).where(eq(users.id, userId));
    return;
  }

  if (role === "site_supervisor" || role === "project_engineer") {
    const projectId = assignedProjectId ? Number(assignedProjectId) : null;
    await db.update(users).set({ assignedProjectId: projectId }).where(eq(users.id, userId));
    await syncProjectAssignments(userId, []);
    return;
  }

  await db.update(users).set({ assignedProjectId: null }).where(eq(users.id, userId));
  await syncProjectAssignments(userId, []);
}
