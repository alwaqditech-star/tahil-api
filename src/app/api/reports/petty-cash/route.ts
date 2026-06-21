import { db } from "@/lib/db";
import { pettyCash, projects, expenses } from "@/lib/schema";
import { requireAuth, getScopedProjectIds, type SessionUser } from "@/lib/auth";
import { parseReportFilters, dateRangeParts } from "@/lib/report-filters";
import { jsonResponse, optionsResponse, requestOrigin } from "@/lib/cors";
import { eq, and, inArray, sql, desc } from "drizzle-orm";

export const maxDuration = 30;

export async function OPTIONS(request: Request) {
  return optionsResponse(requestOrigin(request));
}

export async function GET(request: Request) {
  const origin = requestOrigin(request);
  const session = await requireAuth(request);
  if (session instanceof Response) return session;
  const user = session as SessionUser;

  const url = new URL(request.url);
  const { selectedProjectId, fromDate, toDate } = parseReportFilters(url);

  const scoped = await getScopedProjectIds(user);

  let pettyFilter;
  if (selectedProjectId) {
    pettyFilter = eq(pettyCash.projectId, selectedProjectId);
  } else if (scoped !== null) {
    pettyFilter = scoped.length ? inArray(pettyCash.projectId, scoped) : sql`1=0`;
  }
  const pettyDateParts = dateRangeParts(pettyCash.issuedDate, fromDate, toDate);
  const pettyWhere = pettyFilter
    ? (pettyDateParts.length ? and(pettyFilter, ...pettyDateParts) : pettyFilter)
    : (pettyDateParts.length ? and(...pettyDateParts) : sql`1=1`);

  const [pettyRows, allPettyRecords, projectRows] = await Promise.all([
    db.select({
      assignedToId: pettyCash.assignedToId,
      assignedTo: pettyCash.assignedTo,
      count: sql<number>`COUNT(*)`,
      allocated: sql<string>`COALESCE(SUM(${pettyCash.allocatedAmount}), 0)`,
      used: sql<string>`COALESCE(SUM(${pettyCash.usedAmount}), 0)`,
    }).from(pettyCash).where(pettyWhere).groupBy(pettyCash.assignedToId, pettyCash.assignedTo),
    db.select().from(pettyCash).where(pettyWhere).orderBy(desc(pettyCash.issuedDate)),
    scoped !== null
      ? (scoped.length
          ? db.select({ id: projects.id, name: projects.name }).from(projects).where(inArray(projects.id, scoped))
          : Promise.resolve([]))
      : db.select({ id: projects.id, name: projects.name }).from(projects),
  ]);

  const projectMap = Object.fromEntries(projectRows.map((p) => [p.id, p.name]));
  const employeeIds = [...new Set(allPettyRecords.map((r) => r.assignedToId))];

  const expenseConditions = [];
  if (employeeIds.length) {
    expenseConditions.push(inArray(expenses.submittedById, employeeIds));
  } else {
    expenseConditions.push(sql`1=0`);
  }
  if (selectedProjectId) {
    expenseConditions.push(eq(expenses.projectId, selectedProjectId));
  } else if (scoped !== null) {
    expenseConditions.push(scoped.length ? inArray(expenses.projectId, scoped) : sql`1=0`);
  }
  expenseConditions.push(...dateRangeParts(expenses.expenseDate, fromDate, toDate));

  const expenseRows = employeeIds.length
    ? await db.select({
        id: expenses.id,
        title: expenses.title,
        amount: expenses.amount,
        category: expenses.category,
        status: expenses.status,
        expenseDate: expenses.expenseDate,
        projectId: expenses.projectId,
        submittedById: expenses.submittedById,
      }).from(expenses).where(and(...expenseConditions)).orderBy(desc(expenses.expenseDate))
    : [];

  const custodiesByUser = new Map<number, Array<{
    id: number; purpose: string; projectId: number | null; projectName: string;
    allocatedAmount: number; usedAmount: number; remaining: number;
    status: string; issuedDate: string;
  }>>();

  for (const row of allPettyRecords) {
    const allocated = Number(row.allocatedAmount);
    const used = Number(row.usedAmount);
    const list = custodiesByUser.get(row.assignedToId) ?? [];
    list.push({
      id: row.id,
      purpose: row.purpose,
      projectId: row.projectId,
      projectName: row.projectId ? (projectMap[row.projectId] ?? "—") : "—",
      allocatedAmount: allocated,
      usedAmount: used,
      remaining: allocated - used,
      status: row.status,
      issuedDate: String(row.issuedDate),
    });
    custodiesByUser.set(row.assignedToId, list);
  }

  const expensesByUser = new Map<number, typeof expenseRows>();
  for (const row of expenseRows) {
    if (!row.submittedById) continue;
    const list = expensesByUser.get(row.submittedById) ?? [];
    list.push(row);
    expensesByUser.set(row.submittedById, list);
  }

  const byEmployee = pettyRows.map((r) => {
    const userId = r.assignedToId;
    const empExpenses = (expensesByUser.get(userId) ?? []).map((e) => ({
      id: e.id,
      title: e.title,
      projectId: e.projectId,
      projectName: projectMap[e.projectId] ?? "—",
      category: e.category,
      amount: Number(e.amount),
      status: e.status,
      expenseDate: String(e.expenseDate),
    }));
    const expenseTotal = empExpenses.reduce((s, e) => s + e.amount, 0);
    return {
      userId,
      name: r.assignedTo,
      count: Number(r.count),
      allocated: Number(r.allocated),
      used: Number(r.used),
      remaining: Number(r.allocated) - Number(r.used),
      custodies: custodiesByUser.get(userId) ?? [],
      expenses: empExpenses,
      expenseTotal,
      expenseCount: empExpenses.length,
    };
  }).sort((a, b) => b.allocated - a.allocated);

  const summary = {
    totalAllocated: byEmployee.reduce((s, p) => s + p.allocated, 0),
    totalUsed: byEmployee.reduce((s, p) => s + p.used, 0),
    totalRemaining: byEmployee.reduce((s, p) => s + p.remaining, 0),
    transactionCount: byEmployee.reduce((s, p) => s + p.count, 0),
    totalExpenses: byEmployee.reduce((s, p) => s + p.expenseTotal, 0),
  };

  return jsonResponse({
    filters: { projectId: selectedProjectId },
    summary,
    byEmployee,
    projectsList: projectRows,
  }, 200, origin);
}
