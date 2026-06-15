import { db } from "@/lib/db";
import { pettyCash, projects } from "@/lib/schema";
import { requireAuth, getScopedProjectIds, type SessionUser } from "@/lib/auth";
import { jsonResponse, optionsResponse, requestOrigin } from "@/lib/cors";
import { eq, and, inArray, sql } from "drizzle-orm";

export const maxDuration = 30;

export async function OPTIONS(request: Request) {
  return optionsResponse(requestOrigin(request));
}

export async function GET(request: Request) {
  const origin = requestOrigin(request);
  const session = await requireAuth(request);
  if (session instanceof Response) return session;
  const user = session as SessionUser;

  const url = new URL(request.url);
  const projectIdParam = url.searchParams.get("projectId");
  const selectedProjectId = projectIdParam && projectIdParam !== "all"
    ? Number(projectIdParam)
    : null;

  const scoped = await getScopedProjectIds(user);

  let pettyFilter;
  if (selectedProjectId) {
    pettyFilter = eq(pettyCash.projectId, selectedProjectId);
  } else if (scoped !== null) {
    pettyFilter = scoped.length ? inArray(pettyCash.projectId, scoped) : sql`1=0`;
  }

  const [pettyRows, projectRows] = await Promise.all([
    db.select({
      assignedToId: pettyCash.assignedToId,
      assignedTo: pettyCash.assignedTo,
      count: sql<number>`COUNT(*)`,
      allocated: sql<string>`COALESCE(SUM(${pettyCash.allocatedAmount}), 0)`,
      used: sql<string>`COALESCE(SUM(${pettyCash.usedAmount}), 0)`,
    }).from(pettyCash).where(pettyFilter).groupBy(pettyCash.assignedToId, pettyCash.assignedTo),
    scoped !== null
      ? (scoped.length
          ? db.select({ id: projects.id, name: projects.name }).from(projects).where(inArray(projects.id, scoped))
          : Promise.resolve([]))
      : db.select({ id: projects.id, name: projects.name }).from(projects),
  ]);

  const byEmployee = pettyRows.map((r) => ({
    userId: r.assignedToId,
    name: r.assignedTo,
    count: Number(r.count),
    allocated: Number(r.allocated),
    used: Number(r.used),
    remaining: Number(r.allocated) - Number(r.used),
  })).sort((a, b) => b.allocated - a.allocated);

  const summary = {
    totalAllocated: byEmployee.reduce((s, p) => s + p.allocated, 0),
    totalUsed: byEmployee.reduce((s, p) => s + p.used, 0),
    totalRemaining: byEmployee.reduce((s, p) => s + p.remaining, 0),
    transactionCount: byEmployee.reduce((s, p) => s + p.count, 0),
  };

  return jsonResponse({
    filters: { projectId: selectedProjectId },
    summary,
    byEmployee,
    projectsList: projectRows,
  }, 200, origin);
}
