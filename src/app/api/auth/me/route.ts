import { getSessionUser } from "@/lib/auth";
import { errorResponse, jsonResponse, optionsResponse } from "@/lib/cors";

export async function OPTIONS() {
  return optionsResponse();
}

export async function GET(request: Request) {
  const user = await getSessionUser(request);
  if (!user) return errorResponse("غير مسجل الدخول", 401);
  return jsonResponse(user);
}
