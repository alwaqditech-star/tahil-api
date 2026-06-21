import { db } from "@/lib/db";
import { extracts, projects, contractors } from "@/lib/schema";
import { requireAuth, requireRole, getScopedProjectIds, type SessionUser } from "@/lib/auth";
import { errorResponse, jsonResponse, optionsResponse } from "@/lib/cors";
import { eq, and, inArray, desc } from "drizzle-orm";

function mapExtract(e: typeof extracts.$inferSelect, projectName?: string, contractorName?: string) {
  return {
    id: e.id,
    projectId: e.projectId,
    projectName,
    contractorId: e.contractorId,
    contractorName,
    extractNumber: e.extractNumber,
    title: e.title,
    description: e.description,
    amount: Number(e.amount),
    status: e.status,
    submittedBy: e.submittedBy,
    approvedBy: e.approvedBy,
    extractDate: e.extractDate,
    paidAt: e.paidAt,
    notes: e.notes,
    createdAt: e.createdAt,
  };
}

export async function OPTIONS() {
  return optionsResponse();
}

export async function GET(request: Request) {
  const session = await requireAuth(request);
  if (session instanceof Response) return session;
  const user = session as SessionUser;
  if (!requireRole(user, "admin", "project_manager", "project_engineer")) {
    return errorResponse("ليس لديك صلاحية", 403);
  }

  const scoped = await getScopedProjectIds(user);
  const rows = scoped !== null
    ? (scoped.length ? await db.select().from(extracts).where(inArray(extracts.projectId, scoped)).orderBy(desc(extracts.createdAt)) : [])
    : await db.select().from(extracts).orderBy(desc(extracts.createdAt));

  const projectIds = [...new Set(rows.map((r) => r.projectId))];
  const contractorIds = [...new Set(rows.map((r) => r.contractorId).filter(Boolean))] as number[];

  const projectRows = projectIds.length
    ? await db.select({ id: projects.id, name: projects.name }).from(projects).where(inArray(projects.id, projectIds))
    : [];
  const contractorRows = contractorIds.length
    ? await db.select({ id: contractors.id, name: contractors.name }).from(contractors).where(inArray(contractors.id, contractorIds))
    : [];

  const projectMap = Object.fromEntries(projectRows.map((p) => [p.id, p.name]));
  const contractorMap = Object.fromEntries(contractorRows.map((c) => [c.id, c.name]));

  return jsonResponse(rows.map((e) => mapExtract(e, projectMap[e.projectId], e.contractorId ? contractorMap[e.contractorId] : undefined)));
}

export async function POST(request: Request) {
  const session = await requireAuth(request);
  if (session instanceof Response) return session;
  const user = session as SessionUser;
  if (!requireRole(user, "admin", "project_manager", "project_engineer")) return errorResponse("ليس لديك صلاحية", 403);

  const body = await request.json();
  const extractNumber = body.extractNumber ?? `EXT-${String(Date.now()).slice(-8)}`;

  await db.insert(extracts).values({
    projectId: body.projectId,
    contractorId: body.contractorId,
    extractNumber,
    title: body.title,
    description: body.description ?? null,
    amount: String(body.amount ?? 0),
    status: body.status ?? "draft",
    submittedBy: user.name,
    submittedById: user.id,
    extractDate: body.extractDate,
    workPeriodFrom: body.workPeriodFrom ?? null,
    workPeriodTo: body.workPeriodTo ?? null,
    notes: body.notes ?? null,
  });

  const [created] = await db.select().from(extracts).orderBy(desc(extracts.id)).limit(1);
  const [project] = await db.select({ name: projects.name }).from(projects).where(eq(projects.id, created!.projectId));
  const contractorName = created!.contractorId
    ? (await db.select({ name: contractors.name }).from(contractors).where(eq(contractors.id, created!.contractorId!)))[0]?.name
    : undefined;
  return jsonResponse(mapExtract(created!, project?.name, contractorName), 201);
}
