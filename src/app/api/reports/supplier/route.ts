import { db } from "@/lib/db";
import { suppliers, purchases, projects } from "@/lib/schema";
import { requireAuth, type SessionUser } from "@/lib/auth";
import { errorResponse, jsonResponse, optionsResponse, requestOrigin } from "@/lib/cors";
import { eq, desc } from "drizzle-orm";

export const maxDuration = 30;

export async function OPTIONS(request: Request) {
  return optionsResponse(requestOrigin(request));
}

export async function GET(request: Request) {
  const origin = requestOrigin(request);
  const session = await requireAuth(request);
  if (session instanceof Response) return session;

  const url = new URL(request.url);
  const supplierId = parseInt(url.searchParams.get("supplierId") ?? "0", 10);
  if (!supplierId) return errorResponse("supplierId مطلوب", 400);

  const [supplier] = await db.select().from(suppliers).where(eq(suppliers.id, supplierId));
  if (!supplier) return errorResponse("المورد غير موجود", 404);

  const [purchaseRows, projectRows] = await Promise.all([
    db.select().from(purchases).where(eq(purchases.supplierId, supplierId)).orderBy(desc(purchases.orderDate)),
    db.select({ id: projects.id, name: projects.name }).from(projects),
  ]);

  const projectMap = Object.fromEntries(projectRows.map((p) => [p.id, p.name]));

  const totalPurchases = purchaseRows.reduce((s, p) => s + Number(p.amount), 0);
  const paid = purchaseRows.reduce((s, p) => s + Number(p.paidAmount), 0);
  const remaining = totalPurchases - paid;

  const purchaseList = purchaseRows.map((p) => ({
    id: p.id,
    purchaseNumber: p.purchaseNumber,
    title: p.title,
    projectId: p.projectId,
    projectName: projectMap[p.projectId] ?? "—",
    orderDate: p.orderDate,
    amount: Number(p.amount),
    paidAmount: Number(p.paidAmount),
    status: p.status,
    paymentStatus: p.paymentStatus,
  }));

  return jsonResponse({
    supplier: {
      id: supplier.id,
      name: supplier.name,
      companyName: supplier.companyName,
      category: supplier.category,
      phone: supplier.phone,
      email: supplier.email,
      vatNumber: supplier.vatNumber,
      status: supplier.status,
    },
    summary: {
      totalPurchases,
      paid,
      remaining,
      ordersCount: purchaseRows.length,
    },
    purchases: purchaseList,
  }, 200, origin);
}
