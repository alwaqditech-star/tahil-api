import { db } from "@/lib/db";
import {
  projects, expenses, extracts, pettyCash, purchases, projectItems,
  tasks,
} from "@/lib/schema";
import { requireAuth, getScopedProjectIds, type SessionUser } from "@/lib/auth";
import { jsonResponse, optionsResponse } from "@/lib/cors";
import { isDateBefore, todayISO } from "@/lib/dates";
import { eq, and, inArray, sql, desc } from "drizzle-orm";

export async function OPTIONS() {
  return optionsResponse();
}

export async function GET(request: Request) {
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

  const totalProjects = projectRows.length;
  const activeProjects = projectRows.filter((p) => p.status === "active").length;
  const totalContractValue = projectRows.reduce((s, p) => s + Number(p.contractValue), 0);
  const today = todayISO();
  const delayedProjects = projectRows.filter((p) => isDateBefore(p.endDate, today) && p.status === "active").length;

  const [expR] = await db.select({ total: sql<string>`COALESCE(SUM(${expenses.amount}), 0)` }).from(expenses).where(and(projectFilter, eq(expenses.status, "approved")));
  const [extR] = await db.select({ total: sql<string>`COALESCE(SUM(${extracts.amount}), 0)` }).from(extracts).where(and(extractFilter, sql`${extracts.status} IN ('approved','paid')`));
  const [purR] = await db.select({ total: sql<string>`COALESCE(SUM(${purchases.amount}), 0)` }).from(purchases).where(purchaseFilter);
  const [pendingExpR] = await db.select({ count: sql<number>`COUNT(*)` }).from(expenses).where(and(projectFilter, eq(expenses.status, "pending")));
  const [pendingExtR] = await db.select({ count: sql<number>`COUNT(*)` }).from(extracts).where(and(extractFilter, sql`${extracts.status} IN ('draft','submitted','manager_approved')`));
  const [pettyR] = await db.select({ total: sql<string>`COALESCE(SUM(${pettyCash.allocatedAmount} - ${pettyCash.usedAmount}), 0)` }).from(pettyCash).where(and(pettyFilter, eq(pettyCash.status, "open")));

  const totalExpenses = Number(expR?.total ?? 0);
  const totalExtracts = Number((await db.select({ total: sql<string>`COALESCE(SUM(${extracts.amount}), 0)` }).from(extracts).where(extractFilter))[0]?.total ?? 0);
  const totalPurchases = Number(purR?.total ?? 0);
  const totalCosts = totalExpenses + totalExtracts + totalPurchases;
  const expectedProfit = totalContractValue - totalCosts;
  const actualProfit = expectedProfit;
  const overallProfitMargin = totalContractValue > 0 ? (actualProfit / totalContractValue) * 100 : 0;

  const topProjects = await Promise.all(
    projectRows.slice(0, 5).map(async (p) => {
      const [eR] = await db.select({ total: sql<string>`COALESCE(SUM(${expenses.amount}), 0)` }).from(expenses).where(and(eq(expenses.projectId, p.id), eq(expenses.status, "approved")));
      const [xR] = await db.select({ total: sql<string>`COALESCE(SUM(${extracts.amount}), 0)` }).from(extracts).where(eq(extracts.projectId, p.id));
      const [puR] = await db.select({ total: sql<string>`COALESCE(SUM(${purchases.amount}), 0)` }).from(purchases).where(eq(purchases.projectId, p.id));
      const cv = Number(p.contractValue);
      const costs = Number(eR?.total ?? 0) + Number(xR?.total ?? 0) + Number(puR?.total ?? 0);
      return {
        projectId: p.id,
        projectName: p.name,
        contractValue: cv,
        progressPercent: p.progressPercent,
        totalExpenses: Number(eR?.total ?? 0),
        totalCosts: costs,
        profitMargin: cv > 0 ? Math.round(((cv - costs) / cv) * 10000) / 100 : 0,
      };
    })
  );

  let itemProfitRows: Array<{ name: string; profit: number; type: string }> = [];
  if (projectIds.length) {
    const items = await db.select().from(projectItems).where(inArray(projectItems.projectId, projectIds));
    itemProfitRows = items.map((i) => {
      const estimated = Number(i.quantity) * Number(i.unitPrice);
      const executed = Number(i.executedPrice) || Number(i.executedQuantity) * Number(i.unitPrice);
      return { name: i.name, profit: estimated - executed, type: estimated - executed >= 0 ? "profit" : "loss" };
    }).sort((a, b) => Math.abs(b.profit) - Math.abs(a.profit)).slice(0, 5);
  }

  const recentExpenses = scoped !== null && scoped.length === 0 ? [] : await db.select({
    id: expenses.id, title: expenses.title, amount: expenses.amount, status: expenses.status, expenseDate: expenses.expenseDate,
  }).from(expenses).where(projectFilter).orderBy(desc(expenses.createdAt)).limit(5);

  const recentExtracts = scoped !== null && scoped.length === 0 ? [] : await db.select({
    id: extracts.id, title: extracts.title, amount: extracts.amount, status: extracts.status,
  }).from(extracts).where(extractFilter).orderBy(desc(extracts.createdAt)).limit(5);

  const myTasksCount = user.role === "admin"
    ? (await db.select({ count: sql<number>`COUNT(*)` }).from(tasks).where(sql`${tasks.status} NOT IN ('completed','rejected')`))[0]?.count ?? 0
    : (await db.select({ count: sql<number>`COUNT(*)` }).from(tasks).where(and(eq(tasks.assigneeId, user.id), sql`${tasks.status} NOT IN ('completed','rejected')`)))[0]?.count ?? 0;

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
    myTasksCount: Number(myTasksCount),
    topProjects,
    topProfitableItems: itemProfitRows.filter((i) => i.type === "profit").slice(0, 3),
    topLossItems: itemProfitRows.filter((i) => i.type === "loss").slice(0, 3),
    recentExpenses: recentExpenses.map((e) => ({ ...e, amount: Number(e.amount) })),
    recentExtracts: recentExtracts.map((e) => ({ ...e, amount: Number(e.amount) })),
  });
}
