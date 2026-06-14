import { db } from "@/lib/db";
import { expenses, projects, users } from "@/lib/schema";
import { requireAuth, getScopedProjectIds, type SessionUser } from "@/lib/auth";
import { canCreateResource } from "@/lib/permissions";
import { createNotification, notifyMany } from "@/lib/notify";
import { errorResponse, jsonResponse, optionsResponse } from "@/lib/cors";
import { eq, and, inArray, desc } from "drizzle-orm";

function mapExpense(e: typeof expenses.$inferSelect, projectName?: string) {
  return {
    id: e.id,
    projectId: e.projectId,
    projectName,
    title: e.title,
    description: e.description,
    amount: Number(e.amount),
    category: e.category,
    type: e.type,
    status: e.status,
    submittedBy: e.submittedBy,
    submittedById: e.submittedById,
    contractorId: e.contractorId,
    projectItemId: e.projectItemId,
    approvedBy: e.approvedBy,
    expenseDate: e.expenseDate,
    attachmentUrl: e.attachmentUrl,
    managerApprovedBy: e.managerApprovedBy,
    accountantApprovedBy: e.accountantApprovedBy,
    rejectionReason: e.rejectionReason,
    createdAt: e.createdAt,
    updatedAt: e.updatedAt,
  };
}

export async function OPTIONS() {
  return optionsResponse();
}

export async function GET(request: Request) {
  const session = await requireAuth(request);
  if (session instanceof Response) return session;
  const user = session as SessionUser;

  const url = new URL(request.url);
  const projectId = url.searchParams.get("projectId");
  const status = url.searchParams.get("status");

  const scoped = await getScopedProjectIds(user);
  const conditions = [];

  if (scoped !== null) {
    if (scoped.length === 0) return jsonResponse([]);
    conditions.push(inArray(expenses.projectId, scoped));
  }
  if (projectId) conditions.push(eq(expenses.projectId, parseInt(projectId)));
  if (status && status !== "all") conditions.push(eq(expenses.status, status));

  const rows = conditions.length
    ? await db.select().from(expenses).where(and(...conditions)).orderBy(desc(expenses.createdAt))
    : await db.select().from(expenses).orderBy(desc(expenses.createdAt));

  const projectIds = [...new Set(rows.map((r) => r.projectId))];
  const projectRows = projectIds.length
    ? await db.select({ id: projects.id, name: projects.name }).from(projects).where(inArray(projects.id, projectIds))
    : [];
  const projectMap = Object.fromEntries(projectRows.map((p) => [p.id, p.name]));

  return jsonResponse(rows.map((e) => mapExpense(e, projectMap[e.projectId])));
}

export async function POST(request: Request) {
  const session = await requireAuth(request);
  if (session instanceof Response) return session;
  const user = session as SessionUser;
  if (!canCreateResource(user, "expenses")) return errorResponse("ليس لديك صلاحية", 403);

  const body = await request.json();
  const expenseType = body.type ?? (body.isGeneral ? "general" : "expense");

  const scoped = await getScopedProjectIds(user);
  if (scoped !== null && body.projectId && !scoped.includes(body.projectId)) {
    return errorResponse("المشروع غير مسند إليك", 403);
  }

  await db.insert(expenses).values({
    projectId: body.projectId,
    title: body.title,
    description: body.description,
    amount: String(body.amount ?? 0),
    category: body.category,
    type: expenseType,
    status: "pending",
    submittedBy: user.name,
    submittedById: user.id,
    contractorId: body.contractorId ?? null,
    projectItemId: body.projectItemId ?? null,
    expenseDate: body.expenseDate,
    attachmentUrl: body.attachmentUrl ?? null,
  });

  const [created] = await db.select().from(expenses).orderBy(desc(expenses.id)).limit(1);

  const managers = await db.select({ id: users.id }).from(users).where(
    and(eq(users.isActive, true), sql`${users.role} IN ('admin','project_manager')`)
  );
  await notifyMany(managers.map((m) => m.id), {
    title: "مصروف جديد بانتظار الاعتماد",
    message: `${user.name} سجّل مصروف: ${body.title} — ${body.amount} ر.س`,
    type: "expense",
    link: `${process.env.WEB_ORIGIN ?? "http://localhost:3000"}/expenses`,
  });

  return jsonResponse(mapExpense(created!), 201);
}
