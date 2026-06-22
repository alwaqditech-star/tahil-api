import { db } from "./db";
import { projectAssignments } from "./schema";
import { eq, inArray } from "drizzle-orm";

export async function getAssignedProjectIdsByUserIds(userIds: number[]): Promise<Map<number, number[]>> {
  const map = new Map<number, number[]>();
  if (userIds.length === 0) return map;

  const rows = await db
    .select({ userId: projectAssignments.userId, projectId: projectAssignments.projectId })
    .from(projectAssignments)
    .where(inArray(projectAssignments.userId, userIds));

  for (const row of rows) {
    const list = map.get(row.userId) ?? [];
    list.push(row.projectId);
    map.set(row.userId, list);
  }
  return map;
}

export async function loadAssignedProjectIds(userId: number): Promise<number[]> {
  const map = await getAssignedProjectIdsByUserIds([userId]);
  return map.get(userId) ?? [];
}

export async function syncProjectAssignments(userId: number, projectIds: number[]) {
  const unique = [...new Set(projectIds.filter((id) => id > 0))];
  await db.delete(projectAssignments).where(eq(projectAssignments.userId, userId));
  if (unique.length > 0) {
    await db.insert(projectAssignments).values(unique.map((projectId) => ({ userId, projectId })));
  }
}
