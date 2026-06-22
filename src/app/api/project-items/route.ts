import { db } from "@/lib/db";
import { projectItems, catalogItems } from "@/lib/schema";
import { requireAuth, assertProjectModuleAccess, type SessionUser } from "@/lib/auth";
import { canCreateResource, canEditResource, canDeleteResource } from "@/lib/permissions";
import { errorResponse, jsonResponse, optionsResponse, emptyResponse } from "@/lib/cors";
import { eq, and, inArray } from "drizzle-orm";

function mapItem(i: typeof projectItems.$inferSelect) {
  const qty = Number(i.quantity);
  const unitPrice = Number(i.unitPrice);
  const estimated = Number(i.estimatedPrice);
  const executed = Number(i.executedPrice);
  return {
    id: i.id, projectId: i.projectId, catalogItemId: i.catalogItemId,
    itemCode: i.itemCode, name: i.name, unit: i.unit,
    unitPrice, estimatedPrice: estimated, executedPrice: executed, quantity: qty,
    totalEstimated: qty * estimated, totalExecuted: qty * executed,
    variance: qty * (estimated - executed),
    createdAt: i.createdAt,
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
  const projectId = parseInt(url.searchParams.get("projectId") ?? "0");
  if (!projectId) return errorResponse("projectId مطلوب", 400);

  const denied = await assertProjectModuleAccess(user, projectId);
  if (denied) return denied;

  const rows = await db.select().from(projectItems).where(eq(projectItems.projectId, projectId));
  return jsonResponse(rows.map(mapItem));
}

export async function POST(request: Request) {
  const session = await requireAuth(request);
  if (session instanceof Response) return session;
  const user = session as SessionUser;
  if (!canCreateResource(user, "projectItems")) return errorResponse("ليس لديك صلاحية", 403);

  const body = await request.json();

  let name = body.name;
  let unit = body.unit ?? "";
  let unitPrice = body.unitPrice ?? 0;
  let estimatedPrice = body.estimatedPrice ?? body.unitPrice ?? 0;
  let itemCode = body.itemCode ?? null;
  let catalogItemId = body.catalogItemId ?? null;

  if (body.catalogItemId) {
    const [cat] = await db.select().from(catalogItems).where(eq(catalogItems.id, body.catalogItemId));
    if (!cat) return errorResponse("البند غير موجود في الدليل", 400);
    name = name || cat.name;
    unit = unit || cat.unit;
    unitPrice = unitPrice || Number(cat.defaultUnitPrice);
    estimatedPrice = estimatedPrice || Number(cat.defaultEstimatedPrice);
    itemCode = itemCode || cat.code;
    catalogItemId = cat.id;
  }

  if (!name) return errorResponse("اسم البند مطلوب", 400);

  await db.insert(projectItems).values({
    projectId: body.projectId,
    catalogItemId,
    itemCode,
    name,
    unit,
    unitPrice: String(unitPrice),
    estimatedPrice: String(estimatedPrice),
    executedPrice: String(body.executedPrice ?? 0),
    quantity: String(body.quantity ?? 1),
  });

  const all = await db.select().from(projectItems).where(eq(projectItems.projectId, body.projectId));
  const created = all[all.length - 1];
  return jsonResponse(mapItem(created!), 201);
}
