import { db } from "@/lib/db";
import { purchases, suppliers, projects } from "@/lib/schema";
import { requireAuth, requireRole, getScopedProjectIds, type SessionUser } from "@/lib/auth";
import { errorResponse, jsonResponse, optionsResponse } from "@/lib/cors";
import { eq, inArray, desc } from "drizzle-orm";

function mapPurchase(p: typeof purchases.$inferSelect, supplierName?: string, projectName?: string) {
  return {
    id: p.id,
    supplierId: p.supplierId,
    supplierName,
    projectId: p.projectId,
    projectName,
    purchaseNumber: p.purchaseNumber,
    title: p.title,
    description: p.description,
    amount: Number(p.amount),
    paidAmount: Number(p.paidAmount),
    status: p.status,
    paymentStatus: p.paymentStatus,
    orderDate: p.orderDate,
    expectedDelivery: p.expectedDelivery,
    actualDelivery: p.actualDelivery,
    notes: p.notes,
    createdAt: p.createdAt,
  };
}

export async function OPTIONS() {
  return optionsResponse();
}

export async function GET(request: Request) {
  const session = await requireAuth(request);
  if (session instanceof Response) return session;
  const user = session as SessionUser;
  if (!requireRole(user, "admin", "project_manager", "accountant")) return errorResponse("ليس لديك صلاحية", 403);

  const scoped = await getScopedProjectIds(user);
  const rows = scoped !== null
    ? (scoped.length ? await db.select().from(purchases).where(inArray(purchases.projectId, scoped)).orderBy(desc(purchases.createdAt)) : [])
    : await db.select().from(purchases).orderBy(desc(purchases.createdAt));

  const supplierIds = [...new Set(rows.map((r) => r.supplierId))];
  const projectIds = [...new Set(rows.map((r) => r.projectId))];

  const supplierRows = supplierIds.length
    ? await db.select({ id: suppliers.id, name: suppliers.name }).from(suppliers).where(inArray(suppliers.id, supplierIds))
    : [];
  const projectRows = projectIds.length
    ? await db.select({ id: projects.id, name: projects.name }).from(projects).where(inArray(projects.id, projectIds))
    : [];

  const supplierMap = Object.fromEntries(supplierRows.map((s) => [s.id, s.name]));
  const projectMap = Object.fromEntries(projectRows.map((p) => [p.id, p.name]));

  return jsonResponse(rows.map((p) => mapPurchase(p, supplierMap[p.supplierId], projectMap[p.projectId])));
}

export async function POST(request: Request) {
  const session = await requireAuth(request);
  if (session instanceof Response) return session;
  const user = session as SessionUser;
  if (!requireRole(user, "admin", "project_manager")) return errorResponse("ليس لديك صلاحية", 403);

  const body = await request.json();
  await db.insert(purchases).values({
    supplierId: body.supplierId,
    projectId: body.projectId,
    purchaseNumber: body.purchaseNumber,
    title: body.title,
    description: body.description,
    amount: String(body.amount ?? 0),
    paidAmount: String(body.paidAmount ?? 0),
    status: body.status ?? "draft",
    paymentStatus: body.paymentStatus ?? "unpaid",
    orderDate: body.orderDate,
    expectedDelivery: body.expectedDelivery,
    notes: body.notes,
  });

  const [created] = await db.select().from(purchases).orderBy(desc(purchases.id)).limit(1);
  return jsonResponse(mapPurchase(created!), 201);
}
