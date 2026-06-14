import { db } from "@/lib/db";
import { catalogItems } from "@/lib/schema";
import { requireAuth, type SessionUser } from "@/lib/auth";
import { canEditResource, canDeleteResource } from "@/lib/permissions";
import { errorResponse, jsonResponse, optionsResponse, emptyResponse } from "@/lib/cors";
import { eq, and, ne } from "drizzle-orm";

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

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAuth(request);
  if (session instanceof Response) return session;

  const { id } = await params;
  const [row] = await db.select().from(catalogItems).where(eq(catalogItems.id, parseInt(id)));
  if (!row) return errorResponse("غير موجود", 404);
  return jsonResponse(mapCatalogItem(row));
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAuth(request);
  if (session instanceof Response) return session;
  const user = session as SessionUser;
  if (!canEditResource(user, "catalogItems")) return errorResponse("ليس لديك صلاحية", 403);

  const { id } = await params;
  const body = await request.json();
  const itemId = parseInt(id);

  if (body.code) {
    const dup = await db.select().from(catalogItems)
      .where(and(eq(catalogItems.code, body.code), ne(catalogItems.id, itemId)))
      .limit(1);
    if (dup.length) return errorResponse("كود البند مستخدم مسبقاً", 400);
  }

  await db.update(catalogItems).set({
    code: body.code?.trim() || null,
    name: body.name?.trim(),
    unit: body.unit ?? "",
    defaultUnitPrice: body.defaultUnitPrice != null ? String(body.defaultUnitPrice) : undefined,
    defaultEstimatedPrice: body.defaultEstimatedPrice != null ? String(body.defaultEstimatedPrice) : undefined,
    category: body.category ?? null,
    isActive: body.isActive ?? true,
    notes: body.notes ?? null,
    updatedAt: new Date(),
  }).where(eq(catalogItems.id, itemId));

  const [row] = await db.select().from(catalogItems).where(eq(catalogItems.id, itemId));
  if (!row) return errorResponse("غير موجود", 404);
  return jsonResponse(mapCatalogItem(row));
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAuth(request);
  if (session instanceof Response) return session;
  const user = session as SessionUser;
  if (!canDeleteResource(user)) return errorResponse("ليس لديك صلاحية", 403);

  const { id } = await params;
  await db.delete(catalogItems).where(eq(catalogItems.id, parseInt(id)));
  return emptyResponse();
}
