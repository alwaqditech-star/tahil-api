import { db } from "@/lib/db";
import { projects, expenses, extracts } from "@/lib/schema";
import { requireAuth, requireRole, getProjectModuleScopedIds, assertProjectModuleAccess, canPickProjectInForms, type SessionUser } from "@/lib/auth";
import { errorResponse, jsonResponse, optionsResponse } from "@/lib/cors";
import { eq, and, inArray, like, or, sql } from "drizzle-orm";

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

export async function GET(request: Request) {
  const session = await requireAuth(request);
  if (session instanceof Response) return session;
  const user = session as SessionUser;

  const url = new URL(request.url);
  const status = url.searchParams.get("status");
  const search = url.searchParams.get("search");
  const picker = url.searchParams.get("picker") === "true";

  if (picker) {
    if (!canPickProjectInForms(user)) return errorResponse("ليس لديك صلاحية", 403);
    const rows = await db.select({ id: projects.id, name: projects.name }).from(projects);
    return jsonResponse(rows);
  }

  const denied = await assertProjectModuleAccess(user);
  if (denied) return denied;

  const scoped = await getProjectModuleScopedIds(user);
  const conditions = [];
  if (scoped !== null) {
    if (scoped.length === 0) return jsonResponse([]);
    conditions.push(inArray(projects.id, scoped));
  }
  if (status && status !== "all") conditions.push(eq(projects.status, status));
  if (search) {
    conditions.push(or(like(projects.name, `%${search}%`), like(projects.client, `%${search}%`))!);
  }

  const rows = conditions.length
    ? await db.select().from(projects).where(and(...conditions))
    : await db.select().from(projects);

  const result = await Promise.all(
    rows.map(async (p) => {
      const totals = await getProjectTotals(p.id);
      return mapProject(p, totals.totalExpenses, totals.totalExtracts);
    })
  );

  return jsonResponse(result);
}

export async function POST(request: Request) {
  const session = await requireAuth(request);
  if (session instanceof Response) return session;
  const user = session as SessionUser;
  if (!requireRole(user, "admin")) return errorResponse("ليس لديك صلاحية", 403);

  const body = await request.json();
  const [row] = await db.insert(projects).values({
    name: body.name,
    description: body.description,
    client: body.client,
    location: body.location,
    status: body.status ?? "active",
    startDate: body.startDate,
    endDate: body.endDate,
    contractValue: String(body.contractValue ?? 0),
    budgetAllocated: String(body.budgetAllocated ?? 0),
    progressPercent: body.progressPercent ?? 0,
  });

  const [created] = await db.select().from(projects).where(eq(projects.id, Number(row.insertId)));
  return jsonResponse(mapProject(created!), 201);
}
