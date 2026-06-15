import { db } from "@/lib/db";
import {
  contractors, contractItems, extracts, contracts, projects,
} from "@/lib/schema";
import { requireAuth, type SessionUser } from "@/lib/auth";
import { errorResponse, jsonResponse, optionsResponse, requestOrigin } from "@/lib/cors";
import { eq, desc } from "drizzle-orm";

export const maxDuration = 30;

function pct(part: number, total: number) {
  return total > 0 ? Math.round((part / total) * 1000) / 10 : 0;
}

function itemTotalValue(i: typeof contractItems.$inferSelect) {
  const qty = Number(i.quantity);
  const price = Number(i.unitPrice);
  return i.contractType === "lump_sum" ? price : qty * price;
}

function itemCompletedValue(i: typeof contractItems.$inferSelect) {
  const completed = Number(i.completedQuantity);
  const price = Number(i.unitPrice);
  return i.contractType === "lump_sum"
    ? price * (Number(i.quantity) > 0 ? completed / Number(i.quantity) : 0)
    : completed * price;
}

export async function OPTIONS(request: Request) {
  return optionsResponse(requestOrigin(request));
}

export async function GET(request: Request) {
  const origin = requestOrigin(request);
  const session = await requireAuth(request);
  if (session instanceof Response) return session;

  const url = new URL(request.url);
  const contractorId = parseInt(url.searchParams.get("contractorId") ?? "0", 10);
  if (!contractorId) return errorResponse("contractorId مطلوب", 400);

  const [contractor] = await db.select().from(contractors).where(eq(contractors.id, contractorId));
  if (!contractor) return errorResponse("المقاول غير موجود", 404);

  const [items, extractRows, contractRows, projectRows] = await Promise.all([
    db.select().from(contractItems).where(eq(contractItems.contractorId, contractorId)),
    db.select().from(extracts).where(eq(extracts.contractorId, contractorId)).orderBy(desc(extracts.extractDate)),
    db.select().from(contracts).where(eq(contracts.contractorId, contractorId)),
    db.select({ id: projects.id, name: projects.name }).from(projects),
  ]);

  const projectMap = Object.fromEntries(projectRows.map((p) => [p.id, p.name]));

  const contractValue = items.length
    ? items.reduce((s, i) => s + itemTotalValue(i), 0)
    : contractRows.reduce((s, c) => s + Number(c.totalValue), 0);

  const completedValue = items.reduce((s, i) => s + itemCompletedValue(i), 0);
  const totalExtracts = extractRows.reduce((s, e) => s + Number(e.amount), 0);
  const paidToContractor = extractRows
    .filter((e) => e.status === "paid")
    .reduce((s, e) => s + Number(e.amount), 0);
  const dueToContractor = totalExtracts - paidToContractor;

  const contractItemsReport = items.map((i) => {
    const qty = Number(i.quantity);
    const completed = Number(i.completedQuantity);
    const total = itemTotalValue(i);
    return {
      id: i.id,
      itemCode: i.itemCode,
      projectId: i.projectId,
      projectName: projectMap[i.projectId] ?? "—",
      description: i.description,
      unit: i.unit,
      quantity: qty,
      unitPrice: Number(i.unitPrice),
      total,
      completedQuantity: completed,
      progressPercent: qty > 0 ? Math.round((completed / qty) * 1000) / 10 : 0,
    };
  });

  const extractsReport = extractRows.map((e) => ({
    id: e.id,
    extractNumber: e.extractNumber,
    title: e.title,
    projectId: e.projectId,
    projectName: projectMap[e.projectId] ?? "—",
    extractDate: e.extractDate,
    amount: Number(e.amount),
    status: e.status,
  }));

  return jsonResponse({
    contractor: {
      id: contractor.id,
      name: contractor.name,
      companyName: contractor.companyName,
      phone: contractor.phone,
      email: contractor.email,
      vatNumber: contractor.vatNumber,
      specialty: contractor.specialty,
      status: contractor.status,
    },
    summary: {
      contractValue,
      completedValue,
      completionPercent: pct(completedValue, contractValue),
      totalExtracts,
      paidToContractor,
      dueToContractor,
      extractsCount: extractRows.length,
      itemsCount: items.length,
    },
    contractItems: contractItemsReport,
    extracts: extractsReport,
  }, 200, origin);
}
