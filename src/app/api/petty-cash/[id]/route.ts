import { db } from "@/lib/db";
import { pettyCash } from "@/lib/schema";
import { requireAuth, requireRole, type SessionUser } from "@/lib/auth";
import { assertProjectScope } from "@/lib/access";
import { errorResponse, jsonResponse, optionsResponse, emptyResponse } from "@/lib/cors";
import { toDateOnly } from "@/lib/dates";
import { eq } from "drizzle-orm";

export async function OPTIONS() {
  return optionsResponse();
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAuth(request);
  if (session instanceof Response) return session;
  const user = session as SessionUser;

  const { id } = await params;
  const pettyId = parseInt(id);
  const body = await request.json();
  const [row] = await db.select().from(pettyCash).where(eq(pettyCash.id, pettyId));
  if (!row) return errorResponse("غير موجود", 404);

  const denied = await assertProjectScope(user, row.projectId);
  if (denied) return denied;

  if (body.action === "use") {
    // استخدام العهدة في مشروع — المستلم فقط
    if (row.assignedToId !== user.id && !requireRole(user, "admin")) {
      return errorResponse("ليس لديك صلاحية", 403);
    }
    const newUsed = Number(row.usedAmount) + Number(body.amount ?? 0);
    const targetProjectId = body.projectId ?? row.projectId;
    if (targetProjectId) {
      const deniedProject = await assertProjectScope(user, targetProjectId);
      if (deniedProject) return deniedProject;
    }
    await db.update(pettyCash).set({
      usedAmount: String(newUsed),
      projectId: targetProjectId,
      updatedAt: new Date(),
    }).where(eq(pettyCash.id, pettyId));
  } else if (body.action === "settle") {
    // تسوية العهدة: المحاسب فقط
    if (!requireRole(user, "admin", "accountant")) {
      return errorResponse("تسوية العهدة متاحة للمحاسب فقط", 403);
    }
    await db.update(pettyCash).set({
      status: "settled",
      settledDate: toDateOnly(body.settledDate ?? new Date().toISOString().slice(0, 10)),
      settledById: user.id,
      usedAmount: String(body.usedAmount ?? row.usedAmount),
      updatedAt: new Date(),
    }).where(eq(pettyCash.id, pettyId));
  } else {
    return errorResponse("إجراء غير صالح", 400);
  }

  const [updated] = await db.select().from(pettyCash).where(eq(pettyCash.id, pettyId));
  return jsonResponse(updated);
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAuth(request);
  if (session instanceof Response) return session;
  const user = session as SessionUser;
  if (!requireRole(user, "admin")) return errorResponse("ليس لديك صلاحية", 403);

  const { id } = await params;
  const pettyId = parseInt(id);
  const [existing] = await db.select().from(pettyCash).where(eq(pettyCash.id, pettyId));
  if (!existing) return errorResponse("غير موجود", 404);

  const denied = await assertProjectScope(user, existing.projectId);
  if (denied) return denied;

  await db.delete(pettyCash).where(eq(pettyCash.id, pettyId));
  return emptyResponse();
}
