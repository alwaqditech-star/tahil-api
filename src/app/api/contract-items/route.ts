import { db } from "@/lib/db";
import { contractItems, contractors, projects, catalogItems } from "@/lib/schema";
import { requireAuth, getScopedProjectIds, type SessionUser } from "@/lib/auth";
import { canCreateResource } from "@/lib/permissions";
import { errorResponse, jsonResponse, optionsResponse } from "@/lib/cors";
import { eq, desc } from "drizzle-orm";

function mapItem(i: typeof contractItems.$inferSelect, contractorName?: string, projectName?: string) {
  const qty = Number(i.quantity);
  const price = Number(i.unitPrice);
  const companyCost = Number(i.companyUnitCost);
  const completed = Number(i.completedQuantity);
  const totalValue = i.contractType === "lump_sum" ? price : qty * price;
  const expectedProfit = i.contractType === "lump_sum"
    ? companyCost - price
    : (companyCost - price) * qty;
  return {
    id: i.id,
    contractId: i.contractId,
    contractorId: i.contractorId,
    contractorName,
    projectId: i.projectId,
    projectName,
    projectItemId: i.projectItemId,
    catalogItemId: i.catalogItemId,
    contractType: i.contractType,
    itemCode: i.itemCode,
    description: i.description,
    unit: i.unit,
    quantity: qty,
    unitPrice: price,
    companyUnitCost: companyCost,
    totalValue,
    expectedProfit: Math.round(expectedProfit * 100) / 100,
    profitPercent: companyCost > 0 ? Math.round(((companyCost - price) / companyCost) * 10000) / 100 : 0,
    completedQuantity: completed,
    remainingQuantity: Math.max(0, qty - completed),
    progressPercent: qty > 0 ? Math.round((completed / qty) * 100) : 0,
    status: i.status,
    notes: i.notes,
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
  const contractorId = url.searchParams.get("contractorId");
  const projectId = url.searchParams.get("projectId");

  let rows = await db.select().from(contractItems).orderBy(desc(contractItems.createdAt));
  if (contractorId) rows = rows.filter((r) => r.contractorId === parseInt(contractorId));
  if (projectId) rows = rows.filter((r) => r.projectId === parseInt(projectId));

  const contractorIds = [...new Set(rows.map((r) => r.contractorId))];
  const projectIds = [...new Set(rows.map((r) => r.projectId))];

  const contractorRows = contractorIds.length
    ? await db.select({ id: contractors.id, name: contractors.name }).from(contractors)
    : [];
  const projectRows = projectIds.length
    ? await db.select({ id: projects.id, name: projects.name }).from(projects)
    : [];

  const contractorMap = Object.fromEntries(contractorRows.map((c) => [c.id, c.name]));
  const projectMap = Object.fromEntries(projectRows.map((p) => [p.id, p.name]));

  return jsonResponse(rows.map((i) => mapItem(i, contractorMap[i.contractorId], projectMap[i.projectId])));
}

export async function POST(request: Request) {
  const session = await requireAuth(request);
  if (session instanceof Response) return session;
  const user = session as SessionUser;
  if (!canCreateResource(user, "contractItems")) return errorResponse("ليس لديك صلاحية", 403);

  const body = await request.json();
  if (!body.contractorId || !body.projectId || (!body.description && !body.catalogItemId)) {
    return errorResponse("المقاول والمشروع والوصف مطلوبون", 400);
  }

  let description = body.description;
  let unit = body.unit ?? "وحدة";
  let unitPrice = body.unitPrice ?? 0;
  let companyUnitCost = body.companyUnitCost ?? 0;
  let itemCode = body.itemCode ?? null;
  let catalogItemId = body.catalogItemId ?? null;

  if (body.catalogItemId) {
    const [cat] = await db.select().from(catalogItems).where(eq(catalogItems.id, body.catalogItemId));
    if (!cat) return errorResponse("البند غير موجود في الدليل", 400);
    description = description || cat.name;
    unit = unit || cat.unit;
    unitPrice = unitPrice || Number(cat.defaultUnitPrice);
    companyUnitCost = companyUnitCost || Number(cat.defaultEstimatedPrice);
    itemCode = itemCode || cat.code;
    catalogItemId = cat.id;
  }

  const scoped = await getScopedProjectIds(user);
  if (scoped !== null && !scoped.includes(body.projectId)) {
    return errorResponse("المشروع غير مسند إليك", 403);
  }

  await db.insert(contractItems).values({
    contractId: body.contractId ?? null,
    contractorId: body.contractorId,
    projectId: body.projectId,
    projectItemId: body.projectItemId ?? null,
    catalogItemId,
    contractType: body.contractType ?? "quantity",
    itemCode,
    description,
    unit,
    quantity: String(body.quantity ?? 1),
    unitPrice: String(unitPrice),
    companyUnitCost: String(companyUnitCost),
    status: body.status ?? "pending",
  });

  const [created] = await db.select().from(contractItems).orderBy(desc(contractItems.id)).limit(1);
  return jsonResponse(mapItem(created!), 201);
}
