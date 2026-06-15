import { db } from "@/lib/db";
import { extracts, projects, contractors } from "@/lib/schema";
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
  const contractorIdParam = url.searchParams.get("contractorId");
  const status = url.searchParams.get("status");
  const fromDate = url.searchParams.get("fromDate");
  const toDate = url.searchParams.get("toDate");

  const selectedProjectId = projectIdParam && projectIdParam !== "all"
    ? Number(projectIdParam)
    : null;
  const selectedContractorId = contractorIdParam && contractorIdParam !== "all"
    ? Number(contractorIdParam)
    : null;

  const scoped = await getScopedProjectIds(user);
  const conditions = [];

  if (selectedProjectId) {
    conditions.push(eq(extracts.projectId, selectedProjectId));
  } else if (scoped !== null) {
    conditions.push(scoped.length ? inArray(extracts.projectId, scoped) : sql`1=0`);
  }

  if (selectedContractorId) {
    conditions.push(eq(extracts.contractorId, selectedContractorId));
  }
  if (status && status !== "all") {
    conditions.push(eq(extracts.status, status));
  }
  if (fromDate) {
    conditions.push(sql`${extracts.extractDate} >= ${fromDate}`);
  }
  if (toDate) {
    conditions.push(sql`${extracts.extractDate} <= ${toDate}`);
  }

  const whereClause = conditions.length ? and(...conditions) : undefined;

  const [rows, projectRows, contractorRows] = await Promise.all([
    db.select({
      id: extracts.id,
      extractNumber: extracts.extractNumber,
      title: extracts.title,
      amount: extracts.amount,
      status: extracts.status,
      projectId: extracts.projectId,
      contractorId: extracts.contractorId,
      extractDate: extracts.extractDate,
    }).from(extracts).where(whereClause).orderBy(desc(extracts.extractDate)),
    scoped !== null
      ? (scoped.length
          ? db.select({ id: projects.id, name: projects.name }).from(projects).where(inArray(projects.id, scoped))
          : Promise.resolve([]))
      : db.select({ id: projects.id, name: projects.name }).from(projects),
    db.select({ id: contractors.id, name: contractors.name, companyName: contractors.companyName }).from(contractors),
  ]);

  const projectMap = Object.fromEntries(projectRows.map((p) => [p.id, p.name]));
  const contractorMap = Object.fromEntries(contractorRows.map((c) => [c.id, c.name]));
  const totalAmount = rows.reduce((s, r) => s + Number(r.amount), 0);

  return jsonResponse({
    filters: {
      projectId: selectedProjectId,
      contractorId: selectedContractorId,
      status: status && status !== "all" ? status : null,
      fromDate: fromDate || null,
      toDate: toDate || null,
    },
    summary: {
      extractsCount: rows.length,
      totalAmount,
    },
    projectsList: projectRows,
    contractorsList: contractorRows.map((c) => ({
      id: c.id,
      name: c.companyName ? `${c.name} — ${c.companyName}` : c.name,
    })),
    rows: rows.map((e) => ({
      id: e.id,
      extractNumber: e.extractNumber,
      title: e.title,
      amount: Number(e.amount),
      status: e.status,
      projectId: e.projectId,
      projectName: projectMap[e.projectId] ?? "—",
      contractorId: e.contractorId,
      contractorName: e.contractorId ? (contractorMap[e.contractorId] ?? "—") : "—",
      extractDate: e.extractDate,
    })),
  }, 200, origin);
}
