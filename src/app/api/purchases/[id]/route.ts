import { db } from "@/lib/db";
import { purchases } from "@/lib/schema";
import { requireAuth, requireRole, type SessionUser } from "@/lib/auth";
import { errorResponse, jsonResponse, optionsResponse, emptyResponse } from "@/lib/cors";
import { eq } from "drizzle-orm";

export async function OPTIONS() {
  return optionsResponse();
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAuth(request);
  if (session instanceof Response) return session;
  const user = session as SessionUser;
  if (!requireRole(user, "admin", "project_manager", "accountant")) return errorResponse("ليس لديك صلاحية", 403);

  const { id } = await params;
  const body = await request.json();

  await db.update(purchases).set({
    supplierId: body.supplierId,
    projectId: body.projectId,
    purchaseNumber: body.purchaseNumber,
    title: body.title,
    description: body.description,
    amount: String(body.amount ?? 0),
    paidAmount: String(body.paidAmount ?? 0),
    status: body.status,
    paymentStatus: body.paymentStatus,
    orderDate: body.orderDate,
    expectedDelivery: body.expectedDelivery,
    actualDelivery: body.actualDelivery,
    notes: body.notes,
    updatedAt: new Date(),
  }).where(eq(purchases.id, parseInt(id)));

  const [row] = await db.select().from(purchases).where(eq(purchases.id, parseInt(id)));
  if (!row) return errorResponse("غير موجود", 404);
  return jsonResponse(row);
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAuth(request);
  if (session instanceof Response) return session;
  const user = session as SessionUser;
  if (!requireRole(user, "admin")) return errorResponse("ليس لديك صلاحية", 403);

  const { id } = await params;
  await db.delete(purchases).where(eq(purchases.id, parseInt(id)));
  return emptyResponse();
}
