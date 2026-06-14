import * as XLSX from "xlsx";
import { db } from "@/lib/db";
import { projectItems } from "@/lib/schema";
import { requireAuth, requireRole, getScopedProjectIds, type SessionUser } from "@/lib/auth";
import { errorResponse, jsonResponse, optionsResponse } from "@/lib/cors";
import { eq } from "drizzle-orm";

export async function OPTIONS() {
  return optionsResponse();
}

export async function POST(request: Request) {
  const session = await requireAuth(request);
  if (session instanceof Response) return session;
  const user = session as SessionUser;
  if (!requireRole(user, "admin")) return errorResponse("ليس لديك صلاحية", 403);

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const projectId = parseInt(String(formData.get("projectId") ?? "0"));

  if (!file || !projectId) return errorResponse("الملف ومعرف المشروع مطلوبان", 400);

  const scoped = await getScopedProjectIds(user);
  if (scoped !== null && !scoped.includes(projectId)) {
    return errorResponse("ليس لديك صلاحية", 403);
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);

  const items = rows.map((row) => {
    const name = String(row["اسم البند"] ?? row["name"] ?? row["Name"] ?? "").trim();
    const unit = String(row["الوحدة"] ?? row["unit"] ?? row["Unit"] ?? "").trim();
    const unitPrice = Number(row["سعر البند"] ?? row["unitPrice"] ?? row["Unit Price"] ?? 0);
    const estimatedPrice = Number(row["السعر التقديري"] ?? row["estimatedPrice"] ?? unitPrice);
    const executedPrice = Number(row["السعر المنفذ"] ?? row["executedPrice"] ?? 0);
    const quantity = Number(row["الكمية"] ?? row["quantity"] ?? 1);
    return { projectId, name, unit, unitPrice, estimatedPrice, executedPrice, quantity };
  }).filter((i) => i.name);

  if (items.length === 0) return errorResponse("لم يتم العثور على بنود صالحة في الملف", 400);

  for (const item of items) {
    await db.insert(projectItems).values({
      projectId: item.projectId,
      name: item.name,
      unit: item.unit,
      unitPrice: String(item.unitPrice),
      estimatedPrice: String(item.estimatedPrice),
      executedPrice: String(item.executedPrice),
      quantity: String(item.quantity),
    });
  }

  const inserted = await db.select().from(projectItems).where(eq(projectItems.projectId, projectId));
  return jsonResponse({ inserted: items.length, items: inserted });
}
