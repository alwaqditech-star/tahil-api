import * as XLSX from "xlsx";
import { db } from "@/lib/db";
import { catalogItems } from "@/lib/schema";
import { canCreateResource } from "@/lib/permissions";
import { requireAuth, type SessionUser } from "@/lib/auth";
import { errorResponse, jsonResponse, optionsResponse } from "@/lib/cors";

export async function OPTIONS() {
  return optionsResponse();
}

export async function POST(request: Request) {
  const session = await requireAuth(request);
  if (session instanceof Response) return session;
  const user = session as SessionUser;
  if (!canCreateResource(user, "catalogItems")) {
    return errorResponse("ليس لديك صلاحية", 403);
  }

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  if (!file) return errorResponse("الملف مطلوب", 400);

  const buffer = Buffer.from(await file.arrayBuffer());
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);

  const items = rows.map((row) => {
    const name = String(row["اسم البند"] ?? row["name"] ?? row["Name"] ?? "").trim();
    const code = String(row["الكود"] ?? row["code"] ?? row["Code"] ?? "").trim() || null;
    const unit = String(row["الوحدة"] ?? row["unit"] ?? row["Unit"] ?? "").trim();
    const defaultUnitPrice = Number(row["سعر البند"] ?? row["unitPrice"] ?? row["Unit Price"] ?? 0);
    const defaultEstimatedPrice = Number(row["السعر التقديري"] ?? row["estimatedPrice"] ?? defaultUnitPrice);
    const category = String(row["الفئة"] ?? row["category"] ?? row["Category"] ?? "").trim() || null;
    return { name, code, unit, defaultUnitPrice, defaultEstimatedPrice, category };
  }).filter((i) => i.name);

  if (items.length === 0) return errorResponse("لم يتم العثور على بنود صالحة في الملف", 400);

  let inserted = 0;
  for (const item of items) {
    await db.insert(catalogItems).values({
      code: item.code,
      name: item.name,
      unit: item.unit,
      defaultUnitPrice: String(item.defaultUnitPrice),
      defaultEstimatedPrice: String(item.defaultEstimatedPrice),
      category: item.category,
      isActive: true,
    });
    inserted++;
  }

  return jsonResponse({ inserted });
}
