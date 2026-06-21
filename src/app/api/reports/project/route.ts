import { db } from "@/lib/db";
import {
  projects, expenses, extracts, pettyCash, purchases, projectItems,
} from "@/lib/schema";
import { requireAuth, getScopedProjectIds, type SessionUser } from "@/lib/auth";
import { errorResponse, jsonResponse, optionsResponse, requestOrigin } from "@/lib/cors";
import { eq, and, sql } from "drizzle-orm";

export const maxDuration = 30;

const PIE_COLORS = [
  "#3b82f6", "#eab308", "#22c55e", "#ef4444", "#a855f7",
  "#f97316", "#06b6d4", "#ec4899", "#84cc16", "#6366f1",
];

export async function OPTIONS(request: Request) {
  return optionsResponse(requestOrigin(request));
}

function pct(part: number, total: number) {
  return total > 0 ? Math.round((part / total) * 1000) / 10 : 0;
}

export async function GET(request: Request) {
  const origin = requestOrigin(request);
  const session = await requireAuth(request);
  if (session instanceof Response) return session;
  const user = session as SessionUser;

  const url = new URL(request.url);
  const projectId = parseInt(url.searchParams.get("projectId") ?? "0", 10);
  if (!projectId) return errorResponse("projectId مطلوب", 400);

  const scoped = await getScopedProjectIds(user);
  if (scoped !== null && !scoped.includes(projectId)) {
    return errorResponse("ليس لديك صلاحية على هذا المشروع", 403);
  }

  const [project] = await db.select().from(projects).where(eq(projects.id, projectId));
  if (!project) return errorResponse("المشروع غير موجود", 404);

  const pid = eq(expenses.projectId, projectId);
  const xid = eq(extracts.projectId, projectId);
  const purid = eq(purchases.projectId, projectId);
  const pettyid = eq(pettyCash.projectId, projectId);

  const [
    [approvedExpR],
    [allExpR],
    [pendingExpR],
    [allExtR],
    [paidExtR],
    [purR],
    [pettyUsedR],
    categoryRows,
    items,
  ] = await Promise.all([
    db.select({ total: sql<string>`COALESCE(SUM(${expenses.amount}), 0)` })
      .from(expenses).where(and(pid, eq(expenses.status, "approved"))),
    db.select({ total: sql<string>`COALESCE(SUM(${expenses.amount}), 0)` })
      .from(expenses).where(pid),
    db.select({ total: sql<string>`COALESCE(SUM(${expenses.amount}), 0)` })
      .from(expenses).where(and(pid, sql`${expenses.status} != 'approved'`)),
    db.select({ total: sql<string>`COALESCE(SUM(${extracts.amount}), 0)` })
      .from(extracts).where(xid),
    db.select({ total: sql<string>`COALESCE(SUM(${extracts.amount}), 0)` })
      .from(extracts).where(and(xid, eq(extracts.status, "paid"))),
    db.select({ total: sql<string>`COALESCE(SUM(${purchases.amount}), 0)` })
      .from(purchases).where(purid),
    db.select({ total: sql<string>`COALESCE(SUM(${pettyCash.usedAmount}), 0)` })
      .from(pettyCash).where(pettyid),
    db.select({
      category: expenses.category,
      total: sql<string>`COALESCE(SUM(${expenses.amount}), 0)`,
    }).from(expenses).where(and(pid, eq(expenses.status, "approved")))
      .groupBy(expenses.category),
    db.select().from(projectItems).where(eq(projectItems.projectId, projectId)),
  ]);

  const contractValue = Number(project.contractValue);
  const budgetAllocated = Number(project.budgetAllocated);
  const approvedExpenses = Number(approvedExpR?.total ?? 0);
  const totalExpensesAll = Number(allExpR?.total ?? 0);
  const pendingExpenses = Number(pendingExpR?.total ?? 0);
  const totalExtracts = Number(allExtR?.total ?? 0);
  const paidExtracts = Number(paidExtR?.total ?? 0);
  const totalPurchases = Number(purR?.total ?? 0);
  const pettyCashUsed = Number(pettyUsedR?.total ?? 0);

  const categoryTotal = categoryRows.reduce((s, r) => s + Number(r.total), 0);
  const expensesByCategory = categoryRows
    .map((r, i) => ({
      category: r.category,
      amount: Number(r.total),
      percent: pct(Number(r.total), categoryTotal),
      color: PIE_COLORS[i % PIE_COLORS.length],
    }))
    .sort((a, b) => b.amount - a.amount);

  const contractItems = items.map((i) => {
    const qty = Number(i.quantity);
    const unitPrice = Number(i.unitPrice);
    const executedQty = Number(i.executedQuantity);
    return {
      id: i.id,
      itemCode: i.itemCode,
      description: i.name,
      unit: i.unit,
      quantity: qty,
      unitPrice,
      total: qty * unitPrice,
      executedQuantity: executedQty,
      progressPercent: qty > 0 ? Math.round((executedQty / qty) * 1000) / 10 : 0,
    };
  });

  return jsonResponse({
    project: {
      id: project.id,
      name: project.name,
      client: project.client,
      location: project.location,
      status: project.status,
      startDate: project.startDate,
      endDate: project.endDate,
      contractValue,
      budgetAllocated,
      progressPercent: project.progressPercent,
    },
    summary: {
      totalExpenses: approvedExpenses,
      totalExpensesAll,
      pendingExpenses,
      paidExpenses: approvedExpenses,
      totalExtracts,
      paidExtracts,
      profitMargin: pct(contractValue - approvedExpenses, contractValue),
      itemsCount: items.length,
      budgetConsumptionPercent: pct(approvedExpenses, budgetAllocated),
      totalPurchases,
      pettyCashUsed,
    },
    expensesByCategory,
    contractItems,
  }, 200, origin);
}
