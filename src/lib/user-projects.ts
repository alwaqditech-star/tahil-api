import { db } from "./db";
import { projectAssignments, projects } from "./schema";
import { eq, inArray, and, ne } from "drizzle-orm";

export class ProjectAssignmentConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProjectAssignmentConflictError";
  }
}

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

/** مشروع واحد = مدير مشاريع واحد فقط */
export async function assertProjectsAvailableForManager(userId: number, projectIds: number[]) {
  const unique = [...new Set(projectIds.filter((id) => id > 0))];
  if (unique.length === 0) return;

  const conflicts = await db
    .select({
      projectId: projectAssignments.projectId,
      userId: projectAssignments.userId,
      projectName: projects.name,
    })
    .from(projectAssignments)
    .innerJoin(projects, eq(projects.id, projectAssignments.projectId))
    .where(and(
      inArray(projectAssignments.projectId, unique),
      ne(projectAssignments.userId, userId),
    ));

  if (conflicts.length > 0) {
    const names = conflicts.map((c) => c.projectName).join("، ");
    throw new ProjectAssignmentConflictError(
      `المشروع (${names}) مسند مسبقاً لمدير مشاريع آخر`,
    );
  }
}

export async function syncProjectAssignments(userId: number, projectIds: number[]) {
  const unique = [...new Set(projectIds.filter((id) => id > 0))];
  await db.delete(projectAssignments).where(eq(projectAssignments.userId, userId));
  if (unique.length > 0) {
    await db.insert(projectAssignments).values(unique.map((projectId) => ({ userId, projectId })));
  }
}
