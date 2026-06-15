import { db } from "@/lib/db";
import {
  projects, expenses, extracts, pettyCash, purchases, projectItems,
  tasks,
} from "@/lib/schema";
import { requireAuth, getScopedProjectIds, type SessionUser } from "@/lib/auth";
import { jsonResponse, optionsResponse, requestOrigin } from "@/lib/cors";
import { isDateBefore, todayISO } from "@/lib/dates";
import { eq, and, inArray, sql, desc } from "drizzle-orm";

export const maxDuration = 30;

export async function OPTIONS(request: Request) {
  return optionsResponse(requestOrigin(request));
}

function sumMap(rows: Array<{ projectId: number; total: string | number }>) {
  const m = new Map<number, number>();
  for (const r of rows) m.set(r.projectId, Number(r.total));
  return m;
}

export async function GET(request: Request) {
  const origin = requestOrigin(request);
  const session = await requireAuth(request);
  if (session instanceof Response) return session;
  const user = session as SessionUser;

  const scoped = await getScopedProjectIds(user);
  const projectRows = scoped !== null
    ? (scoped.length ? await db.select().from(projects).where(inArray(projects.id, scoped)) : [])
    : await db.select().from(projects);

  const projectIds = projectRows.map((p) => p.id);
  const projectFilter = scoped !== null
    ? (scoped.length ? inArray(expenses.projectId, scoped) : sql`1=0`)
    : sql`1=1`;
  const extractFilter = scoped !== null
    ? (scoped.length ? inArray(extracts.projectId, scoped) : sql`1=0`)
    : sql`1=1`;
  const purchaseFilter = scoped !== null
    ? (scoped.length ? inArray(purchases.projectId, scoped) : sql`1=0`)
    : sql`1=1`;
  const pettyFilter = scoped !== null
    ? (scoped.length ? inArray(pettyCash.projectId, scoped) : sql`1=0`)
    : sql`1=0`;
  const itemFilter = projectIds.length ? inArray(projectItems.projectId, projectIds) : sql`1=0`;

  const totalProjects = projectRows.length;
  const activeProjects = projectRows.filter((p) => p.status === "active").length;
  const totalContractValue = projectRows.reduce((s, p) => s + Number(p.contractValue), 0);
  const today = todayISO();
  const delayedProjects = projectRows.filter((p) => isDateBefore(p.endDate, today) && p.status === "active").length;

  const [
    [expR],
    [extR],
    [purR],
    [pendingExpR],
    [pendingExtR],
    [pettyR],
    expenseByProject,
    extractByProject,
    purchaseByProject,
    items,
    recentExpenses,
    recentExtracts,
    [myTasksCountR],
  ] = await Promise.all([
    db.select({ total: sql<string>`COALESCE(SUM(${expenses.amount}), 0)` }).from(expenses).where(and(projectFilter, eq(expenses.status, "approved"))),
    db.select({ total: sql<string>`COALESCE(SUM(${extracts.amount}), 0)` }).from(extracts).where(extractFilter),
    db.select({ total: sql<string>`COALESCE(SUM(${purchases.amount}), 0)` }).from(purchases).where(purchaseFilter),
    db.select({ count: sql<number>`COUNT(*)` }).from(expenses).where(and(projectFilter, eq(expenses.status, "pending"))),
    db.select({ count: sql<number>`COUNT(*)` }).from(extracts).where(and(extractFilter, sql`${extracts.status} IN ('draft','submitted','manager_approved')`)),
    db.select({ total: sql<string>`COALESCE(SUM(${pettyCash.allocatedAmount} - ${pettyCash.usedAmount}), 0)` }).from(pettyCash).where(and(pettyFilter, eq(pettyCash.status, "open"))),
    projectIds.length
      ? db.select({ projectId: expenses.projectId, total: sql<string>`COALESCE(SUM(${expenses.amount}), 0)` })
          .from(expenses).where(and(inArray(expenses.projectId, projectIds), eq(expenses.status, "approved"))).groupBy(expenses.projectId)
      : Promise.resolve([]),
    projectIds.length
      ? db.select({ projectId: extracts.projectId, total: sql<string>`COALESCE(SUM(${extracts.amount}), 0)` })
          .from(extracts).where(inArray(extracts.projectId, projectIds)).groupBy(extracts.projectId)
      : Promise.resolve([]),
    projectIds.length
      ? db.select({ projectId: purchases.projectId, total: sql<string>`COALESCE(SUM(${purchases.amount}), 0)` })
          .from(purchases).where(inArray(purchases.projectId, projectIds)).groupBy(purchases.projectId)
      : Promise.resolve([]),
    projectIds.length ? db.select().from(projectItems).where(itemFilter) : Promise.resolve([]),
    scoped !== null && scoped.length === 0
      ? Promise.resolve([])
      : db.select({
          id: expenses.id, title: expenses.title, amount: expenses.amount, status: expenses.status, expenseDate: expenses.expenseDate,
        }).from(expenses).where(projectFilter).orderBy(desc(expenses.createdAt)).limit(5),
    scoped !== null && scoped.length === 0
      ? Promise.resolve([])
      : db.select({
          id: extracts.id, title: extracts.title, amount: extracts.amount, status: extracts.status,
        }).from(extracts).where(extractFilter).orderBy(desc(extracts.createdAt)).limit(5),
    user.role === "admin"
      ? db.select({ count: sql<number>`COUNT(*)` }).from(tasks).where(sql`${tasks.status} NOT IN ('completed','rejected')`)
      : db.select({ count: sql<number>`COUNT(*)` }).from(tasks).where(and(eq(tasks.assigneeId, user.id), sql`${tasks.status} NOT IN ('completed','rejected')`)),
  ]);

  const expByP = sumMap(expenseByProject);
  const extByP = sumMap(extractByProject);
  const purByP = sumMap(purchaseByProject);

  const totalExpenses = Number(expR?.total ?? 0);
  const totalExtracts = Number(extR?.total ?? 0);
  const totalPurchases = Number(purR?.total ?? 0);
  const totalCosts = totalExpenses + totalExtracts + totalPurchases;
  const expectedProfit = totalContractValue - totalCosts;
  const actualProfit = expectedProfit;
  const overallProfitMargin = totalContractValue > 0 ? (actualProfit / totalContractValue) * 100 : 0;

  const topProjects = projectRows.slice(0, 5).map((p) => {
    const e = expByP.get(p.id) ?? 0;
    const x = extByP.get(p.id) ?? 0;
    const pu = purByP.get(p.id) ?? 0;
    const cv = Number(p.contractValue);
    const costs = e + x + pu;
    return {
      projectId: p.id,
      projectName: p.name,
      contractValue: cv,
      progressPercent: p.progressPercent,
      totalExpenses: e,
      totalCosts: costs,
      profitMargin: cv > 0 ? Math.round(((cv - costs) / cv) * 10000) / 100 : 0,
    };
  });

  const itemProfitRows = items.map((i) => {
    const estimated = Number(i.quantity) * Number(i.unitPrice);
    const executed = Number(i.executedPrice) || Number(i.executedQuantity) * Number(i.unitPrice);
    return { name: i.name, profit: estimated - executed, type: estimated - executed >= 0 ? "profit" : "loss" };
  }).sort((a, b) => Math.abs(b.profit) - Math.abs(a.profit)).slice(0, 5);

  return jsonResponse({
    totalProjects,
    activeProjects,
    delayedProjects,
    totalContractValue,
    totalExpenses,
    totalExtracts,
    totalPurchases,
    totalCosts,
    expectedProfit,
    actualProfit,
    totalPettyCashOpen: Number(pettyR?.total ?? 0),
    pendingExpensesCount: Number(pendingExpR?.count ?? 0),
    pendingExtractsCount: Number(pendingExtR?.count ?? 0),
    overallProfitMargin,
    myTasksCount: Number(myTasksCountR?.count ?? 0),
    topProjects,
    topProfitableItems: itemProfitRows.filter((i) => i.type === "profit").slice(0, 3),
    topLossItems: itemProfitRows.filter((i) => i.type === "loss").slice(0, 3),
    recentExpenses: recentExpenses.map((e) => ({ ...e, amount: Number(e.amount) })),
    recentExtracts: recentExtracts.map((e) => ({ ...e, amount: Number(e.amount) })),
  }, 200, origin);
}
