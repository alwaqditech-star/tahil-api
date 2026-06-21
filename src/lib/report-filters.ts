import { sql, type SQL } from "drizzle-orm";

export type ParsedReportFilters = {
  selectedProjectId: number | null;
  fromDate: string | null;
  toDate: string | null;
  status: string | null;
};

export function parseReportFilters(url: URL): ParsedReportFilters {
  const projectIdParam = url.searchParams.get("projectId");
  const selectedProjectId = projectIdParam && projectIdParam !== "all"
    ? Number(projectIdParam)
    : null;
  const fromDate = url.searchParams.get("fromDate") || null;
  const toDate = url.searchParams.get("toDate") || null;
  const statusParam = url.searchParams.get("status");
  const status = statusParam && statusParam !== "all" ? statusParam : null;
  return { selectedProjectId, fromDate, toDate, status };
}

export function dateRangeParts(column: unknown, fromDate: string | null, toDate: string | null): SQL[] {
  const parts: SQL[] = [];
  if (fromDate) parts.push(sql`${column} >= ${fromDate}`);
  if (toDate) parts.push(sql`${column} <= ${toDate}`);
  return parts;
}
