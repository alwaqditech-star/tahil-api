import { db } from "@/lib/db";
import { projects, expenses, extracts } from "@/lib/schema";
import { requireAuth, requireRole, getScopedProjectIds, type SessionUser } from "@/lib/auth";
import { errorResponse, jsonResponse, optionsResponse, emptyResponse } from "@/lib/cors";
import { eq, sql } from "drizzle-orm";

function mapProject(p: typeof projects.$inferSelect, totalExpenses = 0, totalExtracts = 0) {
  return {
    id: p.id,
    name: p.name,
    description: p.description,
    client: p.client,
    location: p.location,
    status: p.status,
    startDate: p.startDate,
    endDate: p.endDate,
    contractValue: Number(p.contractValue),
    budgetAllocated: Number(p.budgetAllocated),
    totalExpenses,
    totalExtracts,
    progressPercent: p.progressPercent,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  };
}

async function getProjectTotals(projectId: number) {
  const [expR] = await db.select({ total: sql<string>`COALESCE(SUM(${expenses.amount}), 0)` }).from(expenses).where(eq(expenses.projectId, projectId));
  const [extR] = await db.select({ total: sql<string>`COALESCE(SUM(${extracts.amount}), 0)` }).from(extracts).where(eq(extracts.projectId, projectId));
  return { totalExpenses: Number(expR?.total ?? 0), totalExtracts: Number(extR?.total ?? 0) };
}

export async function OPTIONS() {
  return optionsResponse();
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAuth(request);
  if (session instanceof Response) return session;
  const user = session as SessionUser;
  const { id } = await params;
  const projectId = parseInt(id);

  const scoped = await getScopedProjectIds(user);
  if (scoped !== null && !scoped.includes(projectId)) {
    return errorResponse("ليس لديك صلاحية لعرض هذا المشروع", 403);
  }

  const [project] = await db.select().from(projects).where(eq(projects.id, projectId));
  if (!project) return errorResponse("المشروع غير موجود", 404);

  const totals = await getProjectTotals(projectId);
  return jsonResponse(mapProject(project, totals.totalExpenses, totals.totalExtracts));
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAuth(request);
  if (session instanceof Response) return session;
  const user = session as SessionUser;
  if (!requireRole(user, "admin")) return errorResponse("ليس لديك صلاحية", 403);

  const { id } = await params;
  const projectId = parseInt(id);
  const body = await request.json();

  await db.update(projects).set({
    name: body.name,
    description: body.description,
    client: body.client,
    location: body.location,
    status: body.status,
    startDate: body.startDate,
    endDate: body.endDate,
    contractValue: String(body.contractValue ?? 0),
    budgetAllocated: String(body.budgetAllocated ?? 0),
    progressPercent: body.progressPercent ?? 0,
    updatedAt: new Date(),
  }).where(eq(projects.id, projectId));

  const [project] = await db.select().from(projects).where(eq(projects.id, projectId));
  if (!project) return errorResponse("المشروع غير موجود", 404);
  const totals = await getProjectTotals(projectId);
  return jsonResponse(mapProject(project, totals.totalExpenses, totals.totalExtracts));
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAuth(request);
  if (session instanceof Response) return session;
  const user = session as SessionUser;
  if (!requireRole(user, "admin")) return errorResponse("ليس لديك صلاحية", 403);

  const { id } = await params;
  await db.delete(projects).where(eq(projects.id, parseInt(id)));
  return emptyResponse();
}
