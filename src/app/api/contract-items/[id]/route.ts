import { db } from "@/lib/db";
import { contractItems } from "@/lib/schema";
import { requireAuth, type SessionUser } from "@/lib/auth";
import { canDeleteResource, canEditResource } from "@/lib/permissions";
import { errorResponse, jsonResponse, optionsResponse, emptyResponse } from "@/lib/cors";
import { eq } from "drizzle-orm";

export async function OPTIONS() {
  return optionsResponse();
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAuth(request);
  if (session instanceof Response) return session;
  const user = session as SessionUser;
  if (!canEditResource(user, "contractItems")) return errorResponse("ليس لديك صلاحية", 403);

  const { id } = await params;
  const body = await request.json();

  await db.update(contractItems).set({
    description: body.description,
    unit: body.unit,
    quantity: String(body.quantity ?? 0),
    unitPrice: String(body.unitPrice ?? 0),
    companyUnitCost: String(body.companyUnitCost ?? 0),
    status: body.status,
    notes: body.notes,
    updatedAt: new Date(),
  }).where(eq(contractItems.id, parseInt(id)));

  const [row] = await db.select().from(contractItems).where(eq(contractItems.id, parseInt(id)));
  if (!row) return errorResponse("غير موجود", 404);
  return jsonResponse(row);
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAuth(request);
  if (session instanceof Response) return session;
  const user = session as SessionUser;
  if (!canDeleteResource(user)) return errorResponse("ليس لديك صلاحية", 403);

  const { id } = await params;
  await db.delete(contractItems).where(eq(contractItems.id, parseInt(id)));
  return emptyResponse();
}
