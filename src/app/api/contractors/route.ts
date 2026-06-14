import { db } from "@/lib/db";
import { contractors, contractItems, extracts } from "@/lib/schema";
import { requireAuth, requireRole, type SessionUser } from "@/lib/auth";
import { errorResponse, jsonResponse, optionsResponse } from "@/lib/cors";
import { desc, sql } from "drizzle-orm";

function mapContractor(
  c: typeof contractors.$inferSelect,
  extras?: { totalContractValue?: number; totalPaid?: number }
) {
  return {
    id: c.id,
    name: c.name,
    companyName: c.companyName,
    phone: c.phone,
    email: c.email,
    specialty: c.specialty,
    licenseNumber: c.licenseNumber,
    vatNumber: c.vatNumber,
    address: c.address,
    status: c.status,
    notes: c.notes,
    totalContractValue: extras?.totalContractValue ?? 0,
    totalPaid: extras?.totalPaid ?? 0,
    createdAt: c.createdAt,
  };
}

export async function OPTIONS() {
  return optionsResponse();
}

export async function GET(request: Request) {
  const session = await requireAuth(request);
  if (session instanceof Response) return session;
  const user = session as SessionUser;
  if (!requireRole(user, "admin", "project_manager", "accountant")) return errorResponse("ليس لديك صلاحية", 403);

  const rows = await db.select().from(contractors).orderBy(desc(contractors.createdAt));

  const contractTotals = await db
    .select({
      contractorId: contractItems.contractorId,
      total: sql<string>`COALESCE(SUM(CASE WHEN ${contractItems.contractType} = 'lump_sum' THEN ${contractItems.unitPrice} ELSE ${contractItems.quantity} * ${contractItems.unitPrice} END), 0)`,
    })
    .from(contractItems)
    .groupBy(contractItems.contractorId);

  const paidTotals = await db
    .select({
      contractorId: extracts.contractorId,
      total: sql<string>`COALESCE(SUM(${extracts.amount}), 0)`,
    })
    .from(extracts)
    .where(sql`${extracts.status} = 'paid'`)
    .groupBy(extracts.contractorId);

  const contractMap = Object.fromEntries(contractTotals.map((r) => [r.contractorId, Number(r.total)]));
  const paidMap = Object.fromEntries(paidTotals.filter((r) => r.contractorId).map((r) => [r.contractorId!, Number(r.total)]));

  return jsonResponse(rows.map((c) => mapContractor(c, {
    totalContractValue: contractMap[c.id] ?? 0,
    totalPaid: paidMap[c.id] ?? 0,
  })));
}

export async function POST(request: Request) {
  const session = await requireAuth(request);
  if (session instanceof Response) return session;
  const user = session as SessionUser;
  if (!requireRole(user, "admin", "project_manager")) return errorResponse("ليس لديك صلاحية", 403);

  const body = await request.json();
  await db.insert(contractors).values({
    name: body.name,
    companyName: body.companyName,
    phone: body.phone,
    email: body.email,
    specialty: body.specialty,
    licenseNumber: body.licenseNumber,
    vatNumber: body.vatNumber,
    address: body.address,
    status: body.status ?? "active",
    notes: body.notes,
  });

  const [created] = await db.select().from(contractors).orderBy(desc(contractors.id)).limit(1);
  return jsonResponse(mapContractor(created!), 201);
}
