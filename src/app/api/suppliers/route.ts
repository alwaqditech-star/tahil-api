import { db } from "@/lib/db";
import { suppliers } from "@/lib/schema";
import { requireAuth, requireRole, type SessionUser } from "@/lib/auth";
import { errorResponse, jsonResponse, optionsResponse } from "@/lib/cors";
import { desc } from "drizzle-orm";

function mapSupplier(s: typeof suppliers.$inferSelect) {
  return {
    id: s.id,
    name: s.name,
    companyName: s.companyName,
    phone: s.phone,
    email: s.email,
    category: s.category,
    vatNumber: s.vatNumber,
    address: s.address,
    status: s.status,
    notes: s.notes,
    createdAt: s.createdAt,
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

  const rows = await db.select().from(suppliers).orderBy(desc(suppliers.createdAt));
  return jsonResponse(rows.map(mapSupplier));
}

export async function POST(request: Request) {
  const session = await requireAuth(request);
  if (session instanceof Response) return session;
  const user = session as SessionUser;
  if (!requireRole(user, "admin", "project_manager")) return errorResponse("ليس لديك صلاحية", 403);

  const body = await request.json();
  await db.insert(suppliers).values({
    name: body.name,
    companyName: body.companyName,
    phone: body.phone,
    email: body.email,
    category: body.category,
    vatNumber: body.vatNumber,
    address: body.address,
    status: body.status ?? "active",
    notes: body.notes,
  });

  const [created] = await db.select().from(suppliers).orderBy(desc(suppliers.id)).limit(1);
  return jsonResponse(mapSupplier(created!), 201);
}
