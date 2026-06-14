import { clearAuthCookie } from "@/lib/auth";
import { jsonResponse, optionsResponse } from "@/lib/cors";

export async function OPTIONS() {
  return optionsResponse();
}

export async function POST() {
  await clearAuthCookie();
  return jsonResponse({ success: true });
}
