import { createToken, setAuthCookie, authenticateUser } from "@/lib/auth";
import { corsHeaders, errorResponse, jsonResponse, optionsResponse } from "@/lib/cors";

export async function OPTIONS() {
  return optionsResponse();
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const { username, password } = body as { username?: string; password?: string };

  if (!username || !password) {
    return errorResponse("اسم المستخدم وكلمة المرور مطلوبان", 400);
  }

  const user = await authenticateUser(username.trim(), password);
  if (!user) {
    return errorResponse("اسم المستخدم أو كلمة المرور غير صحيحة", 401);
  }

  const token = await createToken({
    userId: user.id,
    role: user.role,
    assignedProjectId: user.assignedProjectId,
    assignedProjectIds: user.assignedProjectIds,
  });

  await setAuthCookie(token);

  return jsonResponse({
    ...user,
    token,
  });
}

export async function GET() {
  return jsonResponse({ ok: true }, 200);
}
