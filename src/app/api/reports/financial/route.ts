import { db } from "@/lib/db";
import {
  projects, expenses, extracts, pettyCash, purchases,
  contractors, suppliers, contracts,
} from "@/lib/schema";
import { requireAuth, getScopedProjectIds, type SessionUser } from "@/lib/auth";
import { parseReportFilters, dateRangeParts } from "@/lib/report-filters";
import { calcProfitMargin, sumProjectCosts, EXTRACT_COST_STATUSES } from "@/lib/project-financials";
import { jsonResponse, optionsResponse, requestOrigin } from "@/lib/cors";
import { eq, and, inArray, sql, desc } from "drizzle-orm";

export const maxDuration = 30;

const MONTHS_AR = [
  "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
];

const PIE_COLORS = [
  "#3b82f6", "#eab308", "#22c55e", "#ef4444", "#a855f7",
  "#f97316", "#06b6d4", "#ec4899", "#84cc16", "#6366f1",
];

export async function OPTIONS(request: Request) {
  return optionsResponse(requestOrigin(request));
}

function buildProjectFilter(
  scoped: number[] | null,
  selectedId: number | null,
  column: { name: string },
) {
  if (selectedId) return eq(column as typeof projects.id, selectedId);
  if (scoped !== null) return scoped.length ? inArray(column as typeof projects.id, scoped) : sql`1=0`;
  return sql`1=1`;
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
  const { selectedProjectId, fromDate, toDate } = parseReportFilters(url);

  const scoped = await getScopedProjectIds(user);
  const expenseFilter = buildProjectFilter(scoped, selectedProjectId, expenses.projectId);
  const extractFilter = buildProjectFilter(scoped, selectedProjectId, extracts.projectId);
  const purchaseFilter = buildProjectFilter(scoped, selectedProjectId, purchases.projectId);
  const expDateParts = dateRangeParts(expenses.expenseDate, fromDate, toDate);
  const extDateParts = dateRangeParts(extracts.extractDate, fromDate, toDate);
  const purDateParts = dateRangeParts(purchases.orderDate, fromDate, toDate);
  const allProjectsFilter = buildProjectFilter(scoped, null, projects.id);
  const allProjectRows = await db.select({ id: projects.id, name: projects.name }).from(projects).where(allProjectsFilter);

  const projectRows = selectedProjectId
    ? await db.select().from(projects).where(eq(projects.id, selectedProjectId))
    : await db.select().from(projects).where(allProjectsFilter);
  const projectIds = projectRows.map((p) => p.id);
  const projectMap = Object.fromEntries(projectRows.map((p) => [p.id, p.name]));

  const pettyDateParts = dateRangeParts(pettyCash.issuedDate, fromDate, toDate);
  const pettyFilter = selectedProjectId
    ? eq(pettyCash.projectId, selectedProjectId)
    : scoped !== null
      ? (scoped.length ? inArray(pettyCash.projectId, scoped) : sql`1=0`)
      : sql`1=1`;
  const pettyWhere = pettyDateParts.length ? and(pettyFilter, ...pettyDateParts) : pettyFilter;

  const [
    [expR],
    [extR],
    [purR],
    expenseMonthly,
    extractMonthly,
    purchaseMonthly,
    categoryRows,
    expenseList,
    extractList,
    purchaseList,
    contractorRows,
    supplierRows,
    pettyRows,
    contractRows,
  ] = await Promise.all([
    db.select({ total: sql<string>`COALESCE(SUM(${expenses.amount}), 0)` })
      .from(expenses).where(and(expenseFilter, eq(expenses.status, "approved"), ...expDateParts)),
    db.select({ total: sql<string>`COALESCE(SUM(${extracts.amount}), 0)` })
      .from(extracts).where(and(extractFilter, sql`${extracts.status} IN ('approved','paid')`, ...extDateParts)),
    db.select({ total: sql<string>`COALESCE(SUM(${purchases.amount}), 0)` })
      .from(purchases).where(and(purchaseFilter, ...purDateParts)),
    db.select({
      month: sql<number>`MONTH(${expenses.expenseDate})`,
      total: sql<string>`COALESCE(SUM(${expenses.amount}), 0)`,
    }).from(expenses).where(and(expenseFilter, eq(expenses.status, "approved"), ...expDateParts))
      .groupBy(sql`MONTH(${expenses.expenseDate})`),
    db.select({
      month: sql<number>`MONTH(${extracts.extractDate})`,
      total: sql<string>`COALESCE(SUM(${extracts.amount}), 0)`,
    }).from(extracts).where(and(extractFilter, sql`${extracts.status} IN ('approved','paid')`, ...extDateParts))
      .groupBy(sql`MONTH(${extracts.extractDate})`),
    db.select({
      month: sql<number>`MONTH(${purchases.orderDate})`,
      total: sql<string>`COALESCE(SUM(${purchases.amount}), 0)`,
    }).from(purchases).where(and(purchaseFilter, ...purDateParts))
      .groupBy(sql`MONTH(${purchases.orderDate})`),
    db.select({
      category: expenses.category,
      total: sql<string>`COALESCE(SUM(${expenses.amount}), 0)`,
    }).from(expenses).where(and(expenseFilter, eq(expenses.status, "approved"), ...expDateParts))
      .groupBy(expenses.category),
    db.select({
      id: expenses.id,
      title: expenses.title,
      amount: expenses.amount,
      category: expenses.category,
      status: expenses.status,
      projectId: expenses.projectId,
      expenseDate: expenses.expenseDate,
      submittedBy: expenses.submittedBy,
    }).from(expenses).where(and(expenseFilter, ...expDateParts)).orderBy(desc(expenses.expenseDate)).limit(100),
    db.select({
      id: extracts.id,
      title: extracts.title,
      amount: extracts.amount,
      status: extracts.status,
      projectId: extracts.projectId,
      contractorId: extracts.contractorId,
      extractDate: extracts.extractDate,
      extractNumber: extracts.extractNumber,
    }).from(extracts).where(and(extractFilter, ...extDateParts)).orderBy(desc(extracts.extractDate)).limit(100),
    db.select({
      id: purchases.id,
      title: purchases.title,
      amount: purchases.amount,
      paidAmount: purchases.paidAmount,
      status: purchases.status,
      projectId: purchases.projectId,
      supplierId: purchases.supplierId,
      orderDate: purchases.orderDate,
      purchaseNumber: purchases.purchaseNumber,
    }).from(purchases).where(and(purchaseFilter, ...purDateParts)).orderBy(desc(purchases.orderDate)).limit(100),
    db.select({
      contractorId: extracts.contractorId,
      total: sql<string>`COALESCE(SUM(${extracts.amount}), 0)`,
    }).from(extracts).where(and(extractFilter, sql`${extracts.contractorId} IS NOT NULL`))
      .groupBy(extracts.contractorId),
    db.select({
      supplierId: purchases.supplierId,
      total: sql<string>`COALESCE(SUM(${purchases.amount}), 0)`,
      paid: sql<string>`COALESCE(SUM(${purchases.paidAmount}), 0)`,
    }).from(purchases).where(purchaseFilter).groupBy(purchases.supplierId),
    db.select({
      assignedToId: pettyCash.assignedToId,
      assignedTo: pettyCash.assignedTo,
      count: sql<number>`COUNT(*)`,
      allocated: sql<string>`COALESCE(SUM(${pettyCash.allocatedAmount}), 0)`,
      used: sql<string>`COALESCE(SUM(${pettyCash.usedAmount}), 0)`,
    }).from(pettyCash).where(pettyWhere).groupBy(pettyCash.assignedToId, pettyCash.assignedTo),
    projectIds.length
      ? db.select({
          contractorId: contracts.contractorId,
          total: sql<string>`COALESCE(SUM(${contracts.totalValue}), 0)`,
        }).from(contracts).where(inArray(contracts.projectId, projectIds)).groupBy(contracts.contractorId)
      : Promise.resolve([]),
  ]);

  const totalRevenue = projectRows.reduce((s, p) => s + Number(p.contractValue), 0);
  const totalExpenses = Number(expR?.total ?? 0) + Number(extR?.total ?? 0) + Number(purR?.total ?? 0);
  const totalProfit = totalRevenue - totalExpenses;
  const profitMargin = calcProfitMargin(totalRevenue, totalExpenses);

  const expByMonth = new Map(expenseMonthly.map((r) => [Number(r.month), Number(r.total)]));
  const extByMonth = new Map(extractMonthly.map((r) => [Number(r.month), Number(r.total)]));
  const purByMonth = new Map(purchaseMonthly.map((r) => [Number(r.month), Number(r.total)]));

  const monthlyCashFlow = MONTHS_AR.map((label, i) => {
    const m = i + 1;
    const expenseTotal = (expByMonth.get(m) ?? 0) + (purByMonth.get(m) ?? 0);
    const revenue = extByMonth.get(m) ?? 0;
    return { month: m, monthLabel: label, revenue, expenses: expenseTotal };
  });

  const categoryTotal = categoryRows.reduce((s, r) => s + Number(r.total), 0);
  const expensesByCategory = categoryRows
    .map((r, i) => ({
      category: r.category,
      amount: Number(r.total),
      percent: pct(Number(r.total), categoryTotal),
      color: PIE_COLORS[i % PIE_COLORS.length],
    }))
    .sort((a, b) => b.amount - a.amount);

  const expenseByProject = projectIds.length
    ? await db.select({
        projectId: expenses.projectId,
        total: sql<string>`COALESCE(SUM(${expenses.amount}), 0)`,
      }).from(expenses).where(and(inArray(expenses.projectId, projectIds), eq(expenses.status, "approved")))
        .groupBy(expenses.projectId)
    : [];

  const extractByProject = projectIds.length
    ? await db.select({
        projectId: extracts.projectId,
        total: sql<string>`COALESCE(SUM(${extracts.amount}), 0)`,
      }).from(extracts).where(and(inArray(extracts.projectId, projectIds), inArray(extracts.status, [...EXTRACT_COST_STATUSES])))
        .groupBy(extracts.projectId)
    : [];

  const purchaseByProject = projectIds.length
    ? await db.select({
        projectId: purchases.projectId,
        total: sql<string>`COALESCE(SUM(${purchases.amount}), 0)`,
      }).from(purchases).where(inArray(purchases.projectId, projectIds)).groupBy(purchases.projectId)
    : [];

  const expPMap = Object.fromEntries(expenseByProject.map((r) => [r.projectId, Number(r.total)]));
  const extPMap = Object.fromEntries(extractByProject.map((r) => [r.projectId, Number(r.total)]));
  const purPMap = Object.fromEntries(purchaseByProject.map((r) => [r.projectId, Number(r.total)]));

  const projectReports = projectRows.map((p) => {
    const cv = Number(p.contractValue);
    const exp = expPMap[p.id] ?? 0;
    const ext = extPMap[p.id] ?? 0;
    const pur = purPMap[p.id] ?? 0;
    const costs = sumProjectCosts(exp, ext, pur);
    return {
      id: p.id,
      name: p.name,
      client: p.client,
      status: p.status,
      contractValue: cv,
      expenses: exp,
      extracts: ext,
      purchases: pur,
      totalCosts: costs,
      profit: cv - costs,
      profitMargin: calcProfitMargin(cv, costs),
      progressPercent: p.progressPercent,
    };
  }).sort((a, b) => b.contractValue - a.contractValue);

  const contractorIds = [
    ...new Set([
      ...contractRows.map((r) => r.contractorId),
      ...contractorRows.map((r) => r.contractorId).filter(Boolean) as number[],
    ]),
  ];

  const contractorInfo = contractorIds.length
    ? await db.select({ id: contractors.id, name: contractors.name })
        .from(contractors).where(inArray(contractors.id, contractorIds))
    : [];

  const contractorMap = Object.fromEntries(contractorInfo.map((c) => [c.id, c.name]));
  const contractValueMap = Object.fromEntries(contractRows.map((r) => [r.contractorId, Number(r.total)]));
  const paidMap = Object.fromEntries(contractorRows.map((r) => [r.contractorId, Number(r.total)]));

  const contractorReports = contractorIds.map((id) => {
    const contractValue = contractValueMap[id] ?? 0;
    const paid = paidMap[id] ?? 0;
    return {
      id,
      name: contractorMap[id] ?? `مقاول #${id}`,
      contractValue,
      paid,
      remaining: Math.max(0, contractValue - paid),
    };
  }).sort((a, b) => b.contractValue - a.contractValue);

  const supplierIds = supplierRows.map((r) => r.supplierId);
  const supplierInfo = supplierIds.length
    ? await db.select({ id: suppliers.id, name: suppliers.name, category: suppliers.category })
        .from(suppliers).where(inArray(suppliers.id, supplierIds))
    : [];
  const supplierMap = Object.fromEntries(supplierInfo.map((s) => [s.id, s]));

  const supplierReports = supplierRows.map((r) => ({
    id: r.supplierId,
    name: supplierMap[r.supplierId]?.name ?? `مورد #${r.supplierId}`,
    category: supplierMap[r.supplierId]?.category ?? null,
    purchases: Number(r.total),
    paid: Number(r.paid),
    remaining: Number(r.total) - Number(r.paid),
  })).sort((a, b) => b.purchases - a.purchases);

  const pettyCashByEmployee = pettyRows.map((r) => ({
    userId: r.assignedToId,
    name: r.assignedTo,
    count: Number(r.count),
    allocated: Number(r.allocated),
    used: Number(r.used),
    remaining: Number(r.allocated) - Number(r.used),
  })).sort((a, b) => b.allocated - a.allocated);

  const pettyCashSummary = {
    totalAllocated: pettyCashByEmployee.reduce((s, p) => s + p.allocated, 0),
    totalUsed: pettyCashByEmployee.reduce((s, p) => s + p.used, 0),
    totalRemaining: pettyCashByEmployee.reduce((s, p) => s + p.remaining, 0),
    transactionCount: pettyCashByEmployee.reduce((s, p) => s + p.count, 0),
  };

  const selectedProject = selectedProjectId
    ? projectRows.find((p) => p.id === selectedProjectId)
    : null;

  return jsonResponse({
    filters: {
      projectId: selectedProjectId,
      projectName: selectedProject?.name ?? null,
      scope: selectedProjectId ? "project" : "all",
    },
    summary: {
      totalRevenue,
      totalExpenses,
      totalProfit,
      profitMargin,
      totalExtracts: Number(extR?.total ?? 0),
      totalPurchases: Number(purR?.total ?? 0),
      approvedExpensesOnly: Number(expR?.total ?? 0),
    },
    monthlyCashFlow,
    expensesByCategory,
    projects: projectReports,
    contractors: contractorReports,
    suppliers: supplierReports,
    expenseRows: expenseList.map((e) => ({
      ...e,
      amount: Number(e.amount),
      projectName: projectMap[e.projectId] ?? "—",
    })),
    extractRows: extractList.map((e) => ({
      ...e,
      amount: Number(e.amount),
      projectName: projectMap[e.projectId] ?? "—",
      contractorName: e.contractorId ? (contractorMap[e.contractorId] ?? "—") : "—",
    })),
    purchaseRows: purchaseList.map((p) => ({
      ...p,
      amount: Number(p.amount),
      paidAmount: Number(p.paidAmount),
      projectName: projectMap[p.projectId] ?? "—",
      supplierName: supplierMap[p.supplierId]?.name ?? "—",
    })),
    pettyCashByEmployee,
    pettyCashSummary,
    projectsList: allProjectRows,
  }, 200, origin);
}
