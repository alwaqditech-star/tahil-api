import { db } from "@/lib/db";
import { contracts, contractItems } from "@/lib/schema";
import { requireAuth, type SessionUser } from "@/lib/auth";
import { assertProjectScope } from "@/lib/access";
import { canDeleteResource, canEditResource, canViewContracts } from "@/lib/permissions";
import { errorResponse, jsonResponse, optionsResponse, emptyResponse } from "@/lib/cors";
import { eq } from "drizzle-orm";

export async function OPTIONS() {
  return optionsResponse();
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAuth(request);
  if (session instanceof Response) return session;
  const user = session as SessionUser;
  if (!canViewContracts(user)) return errorResponse("ليس لديك صلاحية", 403);

  const { id } = await params;
  const contractId = parseInt(id);

  const [contract] = await db.select().from(contracts).where(eq(contracts.id, contractId));
  if (!contract) return errorResponse("غير موجود", 404);

  const denied = await assertProjectScope(user, contract.projectId);
  if (denied) return denied;

  const items = await db.select().from(contractItems).where(eq(contractItems.contractId, contractId));

  return jsonResponse({
    ...contract,
    totalValue: Number(contract.totalValue),
    items: items.map((i) => ({
      id: i.id,
      projectItemId: i.projectItemId,
      itemCode: i.itemCode,
      description: i.description,
      unit: i.unit,
      quantity: Number(i.quantity),
      unitPrice: Number(i.unitPrice),
      companyUnitCost: Number(i.companyUnitCost),
      completedQuantity: Number(i.completedQuantity),
      totalValue: Number(i.quantity) * Number(i.unitPrice),
      expectedProfit: (Number(i.companyUnitCost) - Number(i.unitPrice)) * Number(i.quantity),
      progressPercent: Number(i.quantity) > 0 ? Math.round((Number(i.completedQuantity) / Number(i.quantity)) * 100) : 0,
    })),
  });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAuth(request);
  if (session instanceof Response) return session;
  const user = session as SessionUser;
  if (!canDeleteResource(user)) return errorResponse("ليس لديك صلاحية", 403);

  const { id } = await params;
  const contractId = parseInt(id);
  const [existing] = await db.select().from(contracts).where(eq(contracts.id, contractId));
  if (!existing) return errorResponse("غير موجود", 404);

  const denied = await assertProjectScope(user, existing.projectId);
  if (denied) return denied;

  await db.delete(contractItems).where(eq(contractItems.contractId, contractId));
  await db.delete(contracts).where(eq(contracts.id, contractId));
  return emptyResponse();
}
