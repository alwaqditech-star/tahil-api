import { db } from "@/lib/db";
import { contractItems, extractLineItems, extracts } from "@/lib/schema";
import { requireAuth, type SessionUser } from "@/lib/auth";
import { errorResponse, jsonResponse, optionsResponse } from "@/lib/cors";
import { eq, and, inArray, sql } from "drizzle-orm";

export async function OPTIONS() {
  return optionsResponse();
}

/** بنود العقد المتاحة للمستخلص مع الكميات المتبقية */
export async function GET(request: Request) {
  const session = await requireAuth(request);
  if (session instanceof Response) return session;
  const user = session as SessionUser;

  const url = new URL(request.url);
  const projectId = parseInt(url.searchParams.get("projectId") ?? "0");
  const contractorId = parseInt(url.searchParams.get("contractorId") ?? "0");
  const excludeExtractId = url.searchParams.get("excludeExtractId");

  if (!projectId || !contractorId) return errorResponse("projectId و contractorId مطلوبان", 400);

  const items = await db.select().from(contractItems).where(
    and(eq(contractItems.projectId, projectId), eq(contractItems.contractorId, contractorId))
  );

  const itemIds = items.map((i) => i.id);
  if (!itemIds.length) return jsonResponse([]);

  const approvedExtracts = await db.select({ id: extracts.id }).from(extracts).where(
    and(
      eq(extracts.projectId, projectId),
      eq(extracts.contractorId, contractorId),
      sql`${extracts.status} IN ('submitted','manager_approved','approved','paid')`
    )
  );
  const approvedIds = approvedExtracts.map((e) => e.id);

    let prevQtyMap: Record<number, number> = {};
    if (approvedIds.length) {
      const prevLines = await db.select().from(extractLineItems).where(
        and(inArray(extractLineItems.extractId, approvedIds), inArray(extractLineItems.contractItemId, itemIds))
      );
      for (const line of prevLines) {
        if (!line.contractItemId) continue;
        if (excludeExtractId && line.extractId === parseInt(excludeExtractId)) continue;
        prevQtyMap[line.contractItemId] = (prevQtyMap[line.contractItemId] ?? 0) + Number(line.quantity);
      }
    }

  return jsonResponse(items.map((i) => {
    const contracted = i.contractType === "lump_sum" ? 1 : Number(i.quantity);
    const previous = prevQtyMap[i.id] ?? 0;
    const remaining = Math.max(0, contracted - previous);
    const unitPrice = Number(i.unitPrice);
    return {
      contractItemId: i.id,
      projectItemId: i.projectItemId,
      itemCode: i.itemCode,
      description: i.description,
      unit: i.unit,
      contractType: i.contractType,
      contractedQuantity: contracted,
      previousQuantity: previous,
      remainingQuantity: remaining,
      unitPrice,
      progressPercent: contracted > 0 ? Math.round((previous / contracted) * 100) : 0,
    };
  }));
}
