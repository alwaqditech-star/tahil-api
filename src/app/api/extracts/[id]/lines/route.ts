import { db } from "@/lib/db";
import { extractLineItems, extracts, contractItems } from "@/lib/schema";
import { requireAuth, type SessionUser } from "@/lib/auth";
import { canCreateResource } from "@/lib/permissions";
import { errorResponse, jsonResponse, optionsResponse } from "@/lib/cors";
import { eq, and, inArray, sql } from "drizzle-orm";

async function getRemainingQty(contractItemId: number, projectId: number, contractorId: number, excludeExtractId?: number) {
  const [item] = await db.select().from(contractItems).where(eq(contractItems.id, contractItemId));
  if (!item) return 0;

  const contracted = item.contractType === "lump_sum" ? 1 : Number(item.quantity);

  const approvedExtracts = await db.select({ id: extracts.id }).from(extracts).where(
    and(
      eq(extracts.projectId, projectId),
      eq(extracts.contractorId, contractorId),
      sql`${extracts.status} IN ('submitted','manager_approved','approved','paid')`
    )
  );
  const ids = approvedExtracts.map((e) => e.id);
  if (!ids.length) return contracted;

  const lines = await db.select().from(extractLineItems).where(
    and(eq(extractLineItems.contractItemId, contractItemId), inArray(extractLineItems.extractId, ids))
  );

  let used = 0;
  for (const l of lines) {
    if (excludeExtractId && l.extractId === excludeExtractId) continue;
    used += Number(l.quantity);
  }
  return Math.max(0, contracted - used);
}

export async function OPTIONS() {
  return optionsResponse();
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAuth(request);
  if (session instanceof Response) return session;

  const { id } = await params;
  const rows = await db.select().from(extractLineItems).where(eq(extractLineItems.extractId, parseInt(id)));
  return jsonResponse(rows.map((r) => ({
    id: r.id, extractId: r.extractId, projectItemId: r.projectItemId,
    contractItemId: r.contractItemId, description: r.description, unit: r.unit,
    quantity: Number(r.quantity), unitPrice: Number(r.unitPrice), amount: Number(r.amount),
  })));
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAuth(request);
  if (session instanceof Response) return session;
  const user = session as SessionUser;
  if (!canCreateResource(user, "extracts")) return errorResponse("ليس لديك صلاحية", 403);

  const { id } = await params;
  const extractId = parseInt(id);
  const body = await request.json();
  const lines = body.lines as Array<{
    projectItemId?: number; contractItemId?: number; description: string;
    unit: string; quantity: number; unitPrice: number;
  }>;

  const [extract] = await db.select().from(extracts).where(eq(extracts.id, extractId));
  if (!extract) return errorResponse("المستخلص غير موجود", 404);
  if (!["draft", "submitted"].includes(extract.status)) {
    return errorResponse("لا يمكن تعديل بنود مستخلص معتمد", 400);
  }
  if (!extract.contractorId) return errorResponse("يجب تحديد المقاول أولاً", 400);

  for (const line of lines) {
    if (!line.contractItemId) continue;
    const remaining = await getRemainingQty(
      line.contractItemId, extract.projectId, extract.contractorId, extractId
    );
    if (line.quantity > remaining + 0.001) {
      return errorResponse(`الكمية تتجاوز المتبقي (${remaining}) للبند: ${line.description}`, 400);
    }
  }

  await db.delete(extractLineItems).where(eq(extractLineItems.extractId, extractId));

  let total = 0;
  for (const line of lines) {
    const amount = line.quantity * line.unitPrice;
    total += amount;
    await db.insert(extractLineItems).values({
      extractId,
      projectItemId: line.projectItemId ?? null,
      contractItemId: line.contractItemId ?? null,
      description: line.description,
      unit: line.unit,
      quantity: String(line.quantity),
      unitPrice: String(line.unitPrice),
      amount: String(amount),
    });
  }

  await db.update(extracts).set({ amount: String(total), updatedAt: new Date() }).where(eq(extracts.id, extractId));

  const rows = await db.select().from(extractLineItems).where(eq(extractLineItems.extractId, extractId));
  return jsonResponse({ total, lines: rows });
}
