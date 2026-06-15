import { db } from "@/lib/db";
import { expenses, projects } from "@/lib/schema";
import { requireAuth, getScopedProjectIds, type SessionUser } from "@/lib/auth";
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
  const projectIdParam = url.searchParams.get("projectId");
  const category = url.searchParams.get("category");
  const status = url.searchParams.get("status");
  const fromDate = url.searchParams.get("fromDate");
  const toDate = url.searchParams.get("toDate");

  const selectedProjectId = projectIdParam && projectIdParam !== "all"
    ? Number(projectIdParam)
    : null;

  const scoped = await getScopedProjectIds(user);
  const conditions = [];

  if (selectedProjectId) {
    conditions.push(eq(expenses.projectId, selectedProjectId));
  } else if (scoped !== null) {
    conditions.push(scoped.length ? inArray(expenses.projectId, scoped) : sql`1=0`);
  }

  if (category && category !== "all") {
    conditions.push(eq(expenses.category, category));
  }
  if (status && status !== "all") {
    conditions.push(eq(expenses.status, status));
  }
  if (fromDate) {
    conditions.push(sql`${expenses.expenseDate} >= ${fromDate}`);
  }
  if (toDate) {
    conditions.push(sql`${expenses.expenseDate} <= ${toDate}`);
  }

  const whereClause = conditions.length ? and(...conditions) : undefined;

  const [rows, categoryRows, projectRows, distinctCategories] = await Promise.all([
    db.select({
      id: expenses.id,
      title: expenses.title,
      amount: expenses.amount,
      category: expenses.category,
      status: expenses.status,
      projectId: expenses.projectId,
      expenseDate: expenses.expenseDate,
      submittedBy: expenses.submittedBy,
    }).from(expenses).where(whereClause).orderBy(desc(expenses.expenseDate)),
    db.select({
      category: expenses.category,
      count: sql<number>`COUNT(*)`,
      total: sql<string>`COALESCE(SUM(${expenses.amount}), 0)`,
    }).from(expenses).where(whereClause).groupBy(expenses.category),
    scoped !== null
      ? (scoped.length
          ? db.select({ id: projects.id, name: projects.name }).from(projects).where(inArray(projects.id, scoped))
          : Promise.resolve([]))
      : db.select({ id: projects.id, name: projects.name }).from(projects),
    db.select({ category: expenses.category }).from(expenses).where(whereClause).groupBy(expenses.category),
  ]);

  const projectMap = Object.fromEntries(projectRows.map((p) => [p.id, p.name]));
  const totalAmount = rows.reduce((s, r) => s + Number(r.amount), 0);

  const byCategory = categoryRows
    .map((r) => ({
      category: r.category,
      count: Number(r.count),
      total: Number(r.total),
    }))
    .sort((a, b) => b.total - a.total);

  return jsonResponse({
    filters: {
      projectId: selectedProjectId,
      category: category && category !== "all" ? category : null,
      status: status && status !== "all" ? status : null,
      fromDate: fromDate || null,
      toDate: toDate || null,
    },
    summary: {
      transactionsCount: rows.length,
      totalAmount,
      categoriesCount: byCategory.length,
    },
    byCategory,
    categories: distinctCategories.map((c) => c.category).sort(),
    projectsList: projectRows,
    rows: rows.map((e) => ({
      id: e.id,
      title: e.title,
      amount: Number(e.amount),
      category: e.category,
      status: e.status,
      projectId: e.projectId,
      projectName: projectMap[e.projectId] ?? "—",
      expenseDate: e.expenseDate,
      submittedBy: e.submittedBy,
    })),
  }, 200, origin);
}
