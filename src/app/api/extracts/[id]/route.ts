import { db } from "@/lib/db";
import { extracts, extractLineItems, contractItems, projects, contractors } from "@/lib/schema";
import { requireAuth, requireRole, type SessionUser } from "@/lib/auth";
import { assertProjectScope } from "@/lib/access";
import { canApproveExtractManager, canApproveExtractAccountant } from "@/lib/permissions";
import { createNotification } from "@/lib/notify";
import { appPath } from "@/lib/web-url";
import { errorResponse, jsonResponse, optionsResponse, emptyResponse } from "@/lib/cors";
import { todayDateOnly } from "@/lib/dates";
import { eq, sql, and } from "drizzle-orm";

async function syncContractProgress(extractId: number) {
  const lines = await db.select().from(extractLineItems).where(eq(extractLineItems.extractId, extractId));
  for (const line of lines) {
    if (!line.contractItemId) continue;
    const [sumRow] = await db.select({
      total: sql<string>`COALESCE(SUM(${extractLineItems.quantity}), 0)`,
    }).from(extractLineItems)
      .innerJoin(extracts, eq(extractLineItems.extractId, extracts.id))
      .where(and(
        eq(extractLineItems.contractItemId, line.contractItemId),
        sql`${extracts.status} IN ('approved','paid')`
      ));
    await db.update(contractItems).set({
      completedQuantity: String(sumRow?.total ?? 0),
      updatedAt: new Date(),
    }).where(eq(contractItems.id, line.contractItemId));
  }
}

export async function OPTIONS() {
  return optionsResponse();
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAuth(request);
  if (session instanceof Response) return session;
  const user = session as SessionUser;

  const { id } = await params;
  const extractId = parseInt(id);
  const [row] = await db.select().from(extracts).where(eq(extracts.id, extractId));
  if (!row) return errorResponse("غير موجود", 404);

  const denied = await assertProjectScope(user, row.projectId);
  if (denied) return denied;

  const [project] = await db.select({ name: projects.name }).from(projects).where(eq(projects.id, row.projectId));
  const contractorName = row.contractorId
    ? (await db.select({ name: contractors.name }).from(contractors).where(eq(contractors.id, row.contractorId)))[0]?.name
    : undefined;

  return jsonResponse({
    ...row,
    amount: Number(row.amount),
    projectName: project?.name,
    contractorName,
  });
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAuth(request);
  if (session instanceof Response) return session;
  const user = session as SessionUser;
  if (!requireRole(user, "admin", "project_manager")) return errorResponse("ليس لديك صلاحية", 403);

  const { id } = await params;
  const extractId = parseInt(id);
  const [existing] = await db.select().from(extracts).where(eq(extracts.id, extractId));
  if (!existing) return errorResponse("غير موجود", 404);

  const denied = await assertProjectScope(user, existing.projectId);
  if (denied) return denied;

  const body = await request.json();
  if (body.projectId) {
    const deniedNew = await assertProjectScope(user, body.projectId);
    if (deniedNew) return deniedNew;
  }

  await db.update(extracts).set({
    projectId: body.projectId,
    contractorId: body.contractorId,
    extractNumber: body.extractNumber,
    title: body.title,
    description: body.description,
    amount: String(body.amount ?? 0),
    status: body.status,
    extractDate: body.extractDate,
    notes: body.notes,
    updatedAt: new Date(),
  }).where(eq(extracts.id, extractId));

  const [row] = await db.select().from(extracts).where(eq(extracts.id, extractId));
  if (!row) return errorResponse("غير موجود", 404);
  return jsonResponse(row);
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAuth(request);
  if (session instanceof Response) return session;
  const user = session as SessionUser;

  const { id } = await params;
  const extractId = parseInt(id);
  const body = await request.json();
  const action = body.action as string;

  const [extract] = await db.select().from(extracts).where(eq(extracts.id, extractId));
  if (!extract) return errorResponse("غير موجود", 404);

  const denied = await assertProjectScope(user, extract.projectId);
  if (denied) return denied;

  if (action === "submit") {
    if (!requireRole(user, "admin", "project_manager")) return errorResponse("ليس لديك صلاحية", 403);
    if (Number(extract.amount) <= 0) return errorResponse("يجب إضافة بنود للمستخلص أولاً", 400);
    await db.update(extracts).set({ status: "submitted", submittedById: user.id, updatedAt: new Date() }).where(eq(extracts.id, extractId));
    await createNotification({
      userId: user.id,
      title: "مستخلص مُرسل للاعتماد",
      message: `مستخلص ${extract.extractNumber} — ${extract.title}`,
      type: "extract",
      link: appPath(`/extracts/${id}`),
    });
  } else if (action === "manager_approve") {
    if (!canApproveExtractManager(user)) return errorResponse("ليس لديك صلاحية", 403);
    if (extract.status !== "submitted") return errorResponse("يجب إرسال المستخلص أولاً", 400);
    await db.update(extracts).set({
      status: "manager_approved", managerApprovedBy: user.name, managerApprovedAt: new Date(), updatedAt: new Date(),
    }).where(eq(extracts.id, extractId));
  } else if (action === "accountant_approve") {
    if (!canApproveExtractAccountant(user)) return errorResponse("ليس لديك صلاحية", 403);
    if (extract.status !== "manager_approved") return errorResponse("يجب اعتماد المدير أولاً", 400);
    await db.update(extracts).set({
      status: "approved", accountantApprovedBy: user.name, accountantApprovedAt: new Date(),
      approvedBy: user.name, updatedAt: new Date(),
    }).where(eq(extracts.id, extractId));
    await syncContractProgress(extractId);
  } else if (action === "mark_paid") {
    if (!canApproveExtractAccountant(user)) return errorResponse("ليس لديك صلاحية", 403);
    if (extract.status !== "approved") return errorResponse("يجب اعتماد المستخلص أولاً", 400);
    await db.update(extracts).set({
      status: "paid", paidAt: todayDateOnly(), updatedAt: new Date(),
    }).where(eq(extracts.id, extractId));
  } else if (action === "reject") {
    if (!requireRole(user, "admin", "accountant")) return errorResponse("ليس لديك صلاحية", 403);
    await db.update(extracts).set({ status: "rejected", updatedAt: new Date() }).where(eq(extracts.id, extractId));
  } else {
    return errorResponse("إجراء غير صالح", 400);
  }

  const [row] = await db.select().from(extracts).where(eq(extracts.id, extractId));
  return jsonResponse(row);
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAuth(request);
  if (session instanceof Response) return session;
  const user = session as SessionUser;
  if (!requireRole(user, "admin")) return errorResponse("ليس لديك صلاحية", 403);

  const { id } = await params;
  const extractId = parseInt(id);
  const [existing] = await db.select().from(extracts).where(eq(extracts.id, extractId));
  if (!existing) return errorResponse("غير موجود", 404);

  const denied = await assertProjectScope(user, existing.projectId);
  if (denied) return denied;

  await db.delete(extracts).where(eq(extracts.id, extractId));
  return emptyResponse();
}
