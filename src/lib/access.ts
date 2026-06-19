import { getScopedProjectIds, type SessionUser } from "./auth";
import { errorResponse } from "./cors";

/** يتحقق أن المستخدم يملك صلاحية الوصول لمشروع محدد (منع IDOR) */
export async function assertProjectScope(
  user: SessionUser,
  projectId: number | null | undefined,
  message = "ليس لديك صلاحية للوصول إلى هذا المشروع",
): Promise<Response | null> {
  if (projectId == null) return null;
  const scoped = await getScopedProjectIds(user);
  if (scoped !== null && !scoped.includes(projectId)) {
    return errorResponse(message, 403);
  }
  return null;
}

export function assertRoles(
  user: SessionUser,
  roles: string[],
  message = "ليس لديك صلاحية",
): Response | null {
  if (!roles.includes(user.role)) return errorResponse(message, 403);
  return null;
}

export function assertSelfOrAdmin(
  user: SessionUser,
  targetUserId: number,
): Response | null {
  if (user.role !== "admin" && user.id !== targetUserId) {
    return errorResponse("ليس لديك صلاحية", 403);
  }
  return null;
}
