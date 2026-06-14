import { db } from "@/lib/db";
import { expenses, users } from "@/lib/schema";
import { requireAuth, type SessionUser } from "@/lib/auth";
import { canManagerApproveExpense, canAccountantApproveExpense, canEditResource, canDeleteResource } from "@/lib/permissions";
import { createNotification } from "@/lib/notify";
import { errorResponse, jsonResponse, optionsResponse, emptyResponse } from "@/lib/cors";
import { eq, and, sql } from "drizzle-orm";

export async function OPTIONS() {
  return optionsResponse();
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAuth(request);
  if (session instanceof Response) return session;
  const user = session as SessionUser;
  if (!canEditResource(user, "expenses")) return errorResponse("ليس لديك صلاحية", 403);

  const { id } = await params;
  const body = await request.json();

  await db.update(expenses).set({
    projectId: body.projectId,
    title: body.title,
    description: body.description,
    amount: String(body.amount ?? 0),
    category: body.category,
    type: body.type ?? "expense",
    expenseDate: body.expenseDate,
    attachmentUrl: body.attachmentUrl,
    contractorId: body.contractorId ?? null,
    projectItemId: body.projectItemId ?? null,
    supplierId: body.supplierId ?? null,
    updatedAt: new Date(),
  }).where(eq(expenses.id, parseInt(id)));

  const [row] = await db.select().from(expenses).where(eq(expenses.id, parseInt(id)));
  if (!row) return errorResponse("غير موجود", 404);
  return jsonResponse(row);
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAuth(request);
  if (session instanceof Response) return session;
  const user = session as SessionUser;

  const { id } = await params;
  const body = await request.json();
  const action = body.action as string;

  const [expense] = await db.select().from(expenses).where(eq(expenses.id, parseInt(id)));
  if (!expense) return errorResponse("غير موجود", 404);

  if (action === "manager_approve") {
    if (!canManagerApproveExpense(user)) return errorResponse("ليس لديك صلاحية", 403);
    if (expense.status !== "pending") return errorResponse("الحالة لا تسمح باعتماد المدير", 400);
    await db.update(expenses).set({
      status: "manager_approved",
      managerApprovedBy: user.name,
      managerApprovedAt: new Date(),
      updatedAt: new Date(),
    }).where(eq(expenses.id, parseInt(id)));

    const accountants = await db.select({ id: users.id }).from(users).where(and(eq(users.isActive, true), sql`${users.role} IN ('admin','accountant')`));
    for (const acc of accountants) {
      await createNotification({
        userId: acc.id,
        title: "مصروف بانتظار الاعتماد النهائي",
        message: `مصروف "${expense.title}" معتمد من المدير — بانتظار المحاسب`,
        type: "expense",
        link: `${process.env.WEB_ORIGIN ?? "http://localhost:3000"}/expenses`,
      });
    }
  } else if (action === "accountant_approve") {
    if (!canAccountantApproveExpense(user)) return errorResponse("ليس لديك صلاحية", 403);
    if (expense.status !== "manager_approved") return errorResponse("يجب اعتماد المدير أولاً", 400);
    await db.update(expenses).set({
      status: "approved",
      accountantApprovedBy: user.name,
      accountantApprovedAt: new Date(),
      approvedBy: user.name,
      updatedAt: new Date(),
    }).where(eq(expenses.id, parseInt(id)));
  } else if (action === "reject") {
    if (!canManagerApproveExpense(user) && !canAccountantApproveExpense(user)) return errorResponse("ليس لديك صلاحية", 403);
    await db.update(expenses).set({
      status: "rejected",
      rejectionReason: body.reason ?? "مرفوض",
      updatedAt: new Date(),
    }).where(eq(expenses.id, parseInt(id)));
  } else {
    return errorResponse("إجراء غير صالح", 400);
  }

  const [row] = await db.select().from(expenses).where(eq(expenses.id, parseInt(id)));
  return jsonResponse(row);
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAuth(request);
  if (session instanceof Response) return session;
  const user = session as SessionUser;
  if (!canDeleteResource(user)) return errorResponse("ليس لديك صلاحية", 403);

  const { id } = await params;
  await db.delete(expenses).where(eq(expenses.id, parseInt(id)));
  return emptyResponse();
}
