import { db } from "@/lib/db";
import { catalogItems } from "@/lib/schema";
import { requireAuth, requireRole, type SessionUser } from "@/lib/auth";
import { canCreateResource } from "@/lib/permissions";
import { errorResponse, jsonResponse, optionsResponse } from "@/lib/cors";
import { desc, eq } from "drizzle-orm";

function mapCatalogItem(c: typeof catalogItems.$inferSelect) {
  return {
    id: c.id,
    code: c.code,
    name: c.name,
    unit: c.unit,
    defaultUnitPrice: Number(c.defaultUnitPrice),
    defaultEstimatedPrice: Number(c.defaultEstimatedPrice),
    category: c.category,
    isActive: c.isActive,
    notes: c.notes,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
  };
}

export async function OPTIONS() {
  return optionsResponse();
}

export async function GET(request: Request) {
  const session = await requireAuth(request);
  if (session instanceof Response) return session;
  const user = session as SessionUser;
  if (!requireRole(user, "admin", "project_manager", "accountant")) {
    return errorResponse("ليس لديك صلاحية", 403);
  }

  const url = new URL(request.url);
  const activeOnly = url.searchParams.get("active") === "true";

  let rows = await db.select().from(catalogItems).orderBy(desc(catalogItems.createdAt));
  if (activeOnly) rows = rows.filter((r) => r.isActive);

  return jsonResponse(rows.map(mapCatalogItem));
}

export async function POST(request: Request) {
  const session = await requireAuth(request);
  if (session instanceof Response) return session;
  const user = session as SessionUser;
  if (!canCreateResource(user, "catalogItems")) return errorResponse("ليس لديك صلاحية", 403);

  const body = await request.json();
  if (!body.name?.trim()) return errorResponse("اسم البند مطلوب", 400);

  if (body.code) {
    const existing = await db.select().from(catalogItems).where(eq(catalogItems.code, body.code)).limit(1);
    if (existing.length) return errorResponse("كود البند مستخدم مسبقاً", 400);
  }

  await db.insert(catalogItems).values({
    code: body.code?.trim() || null,
    name: body.name.trim(),
    unit: body.unit ?? "",
    defaultUnitPrice: String(body.defaultUnitPrice ?? 0),
    defaultEstimatedPrice: String(body.defaultEstimatedPrice ?? body.defaultUnitPrice ?? 0),
    category: body.category ?? null,
    isActive: body.isActive ?? true,
    notes: body.notes ?? null,
  });

  const [created] = await db.select().from(catalogItems).orderBy(desc(catalogItems.id)).limit(1);
  return jsonResponse(mapCatalogItem(created!), 201);
}
