import { db } from "@/lib/db";
import { expenseCategories } from "@/lib/schema";
import { requireAuth } from "@/lib/auth";
import { jsonResponse, optionsResponse } from "@/lib/cors";

export async function OPTIONS() {
  return optionsResponse();
}

export async function GET(request: Request) {
  const session = await requireAuth(request);
  if (session instanceof Response) return session;

  const rows = await db.select().from(expenseCategories);
  return jsonResponse(rows);
}
