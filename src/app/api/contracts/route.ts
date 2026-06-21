import { db } from "@/lib/db";
import { contracts, contractItems, contractors, projects, projectItems, catalogItems } from "@/lib/schema";
import { requireAuth, getScopedProjectIds, type SessionUser } from "@/lib/auth";
import { canCreateResource } from "@/lib/permissions";
import { errorResponse, jsonResponse, optionsResponse } from "@/lib/cors";
import { eq, desc } from "drizzle-orm";

function mapContract(c: typeof contracts.$inferSelect, extras?: Record<string, unknown>) {
  return {
    id: c.id,
    projectId: c.projectId,
    contractorId: c.contractorId,
    contractType: c.contractType,
    title: c.title,
    totalValue: Number(c.totalValue),
    status: c.status,
    startDate: c.startDate,
    endDate: c.endDate,
    notes: c.notes,
    ...extras,
  };
}

export async function OPTIONS() {
  return optionsResponse();
}

export async function GET(request: Request) {
  const session = await requireAuth(request);
  if (session instanceof Response) return session;
  const user = session as SessionUser;

  if (user.role === "accountant") {
    return errorResponse("ليس لديك صلاحية لعرض العقود", 403);
  }

  const url = new URL(request.url);
  const projectId = url.searchParams.get("projectId");
  const contractorId = url.searchParams.get("contractorId");

  let rows = await db.select().from(contracts).orderBy(desc(contracts.createdAt));

  const scoped = await getScopedProjectIds(user);
  if (scoped !== null) {
    if (scoped.length === 0) return jsonResponse([]);
    rows = rows.filter((r) => scoped.includes(r.projectId));
  }
  if (projectId) rows = rows.filter((r) => r.projectId === parseInt(projectId));
  if (contractorId) rows = rows.filter((r) => r.contractorId === parseInt(contractorId));

  const contractorRows = await db.select({ id: contractors.id, name: contractors.name }).from(contractors);
  const projectRows = await db.select({ id: projects.id, name: projects.name }).from(projects);
  const contractorMap = Object.fromEntries(contractorRows.map((c) => [c.id, c.name]));
  const projectMap = Object.fromEntries(projectRows.map((p) => [p.id, p.name]));

  const result = await Promise.all(rows.map(async (c) => {
    const items = await db.select().from(contractItems).where(eq(contractItems.contractId, c.id));
    const totalProfit = items.reduce((s, i) => {
      const qty = Number(i.quantity);
      const companyCost = Number(i.companyUnitCost) * qty;
      const contractorCost = Number(i.unitPrice) * qty;
      return s + (companyCost - contractorCost);
    }, 0);
    return mapContract(c, {
      contractorName: contractorMap[c.contractorId],
      projectName: projectMap[c.projectId],
      itemsCount: items.length,
      expectedProfit: Math.round(totalProfit * 100) / 100,
    });
  }));

  return jsonResponse(result);
}

export async function POST(request: Request) {
  const session = await requireAuth(request);
  if (session instanceof Response) return session;
  const user = session as SessionUser;
  if (!canCreateResource(user, "contracts")) return errorResponse("ليس لديك صلاحية", 403);

  const body = await request.json();
  if (!body.projectId || !body.contractorId || !body.title) {
    return errorResponse("المشروع والمقاول والعنوان مطلوبون", 400);
  }

  const scoped = await getScopedProjectIds(user);
  if (scoped !== null && !scoped.includes(body.projectId)) {
    return errorResponse("المشروع غير مسند إليك", 403);
  }

  const contractType = body.contractType ?? "quantity";
  let totalValue = Number(body.totalValue ?? 0);

  await db.insert(contracts).values({
    projectId: body.projectId,
    contractorId: body.contractorId,
    contractType,
    title: body.title,
    totalValue: String(totalValue),
    status: "active",
    startDate: body.startDate ?? null,
    endDate: body.endDate ?? null,
    notes: body.notes ?? null,
  });

  const [created] = await db.select().from(contracts).orderBy(desc(contracts.id)).limit(1);

  if (Array.isArray(body.items) && body.items.length > 0) {
    let computedTotal = 0;
    for (const item of body.items) {
      const qty = Number(item.quantity ?? 1);
      const price = Number(item.unitPrice ?? 0);
      const amount = contractType === "lump_sum" ? price : qty * price;
      computedTotal += amount;

      let description = item.description;
      let unit = item.unit ?? (contractType === "lump_sum" ? "مقطوع" : "وحدة");
      let itemCode = item.itemCode ?? null;
      let catalogItemId = item.catalogItemId ?? null;

      if (item.catalogItemId) {
        const [cat] = await db.select().from(catalogItems).where(eq(catalogItems.id, item.catalogItemId));
        if (cat) {
          description = description || cat.name;
          unit = unit || cat.unit;
          itemCode = itemCode || cat.code;
          catalogItemId = cat.id;
        }
      }

      await db.insert(contractItems).values({
        contractId: created!.id,
        contractorId: body.contractorId,
        projectId: body.projectId,
        projectItemId: item.projectItemId ?? null,
        catalogItemId,
        contractType,
        itemCode,
        description,
        unit,
        quantity: String(qty),
        unitPrice: String(price),
        companyUnitCost: String(item.companyUnitCost ?? 0),
        status: "active",
      });
    }
    if (contractType === "quantity") {
      await db.update(contracts).set({ totalValue: String(computedTotal) }).where(eq(contracts.id, created!.id));
      totalValue = computedTotal;
    }
  }

  return jsonResponse(mapContract({ ...created!, totalValue: String(totalValue) }), 201);
}
