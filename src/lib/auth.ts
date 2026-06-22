import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { errorResponse } from "./cors";
import { db } from "./db";
import { users, projectAssignments } from "./schema";
import { eq, or } from "drizzle-orm";

const COOKIE_NAME = "jade_erp_token";
const secret = new TextEncoder().encode(process.env.JWT_SECRET ?? "dev-secret");

if (
  process.env.NODE_ENV === "production" &&
  (!process.env.JWT_SECRET || process.env.JWT_SECRET === "dev-secret")
) {
  console.error("[auth] JWT_SECRET must be set to a strong value in production");
}

export type SessionUser = {
  id: number;
  name: string;
  email: string;
  username: string | null;
  role: string;
  department: string | null;
  assignedProjectId: number | null;
  assignedProjectIds: number[];
};

export type TokenPayload = {
  userId: number;
  role: string;
  assignedProjectId: number | null;
  assignedProjectIds: number[];
};

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export async function createToken(payload: TokenPayload) {
  return new SignJWT(payload as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secret);
}

export async function verifyToken(token: string): Promise<TokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret);
    return payload as unknown as TokenPayload;
  } catch {
    return null;
  }
}

export async function setAuthCookie(token: string) {
  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7,
    path: "/",
  });
}

export async function clearAuthCookie() {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

export async function getTokenFromRequest(request: Request) {
  const auth = request.headers.get("authorization");
  if (auth?.startsWith("Bearer ")) return auth.slice(7);
  try {
    const qToken = new URL(request.url).searchParams.get("access_token");
    if (qToken) return qToken;
  } catch {
    /* ignore */
  }
  const cookieHeader = request.headers.get("cookie") ?? "";
  const match = cookieHeader.match(new RegExp(`${COOKIE_NAME}=([^;]+)`));
  return match?.[1] ?? null;
}

async function loadAssignedProjectIds(userId: number) {
  const rows = await db
    .select({ projectId: projectAssignments.projectId })
    .from(projectAssignments)
    .where(eq(projectAssignments.userId, userId));
  return rows.map((r) => r.projectId);
}

export async function getSessionUser(request: Request): Promise<SessionUser | null> {
  const token = await getTokenFromRequest(request);
  if (!token) return null;
  const payload = await verifyToken(token);
  if (!payload?.userId) return null;

  const [user] = await db.select().from(users).where(eq(users.id, payload.userId));
  if (!user || !user.isActive) return null;

  const assignedProjectIds =
    user.role === "project_manager" ? await loadAssignedProjectIds(user.id) : [];

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    username: user.username,
    role: user.role,
    department: user.department,
    assignedProjectId: user.assignedProjectId,
    assignedProjectIds,
  };
}

export async function requireAuth(request: Request): Promise<SessionUser | Response> {
  const user = await getSessionUser(request);
  if (!user) return errorResponse("غير مصرح بالدخول", 401, request.headers.get("origin"));
  return user;
}

export function requireRole(user: SessionUser, ...roles: string[]): boolean {
  return roles.includes(user.role);
}

/** جميع المشاريع للتقارير والمالية (المحاسب يرى الإجماليات فقط، لا تفاصيل المشروع) */
export async function getScopedProjectIds(user: SessionUser): Promise<number[] | null> {
  if (user.role === "admin" || user.role === "accountant") return null;
  if ((user.role === "site_supervisor" || user.role === "project_engineer") && user.assignedProjectId) {
    return [user.assignedProjectId];
  }
  if (user.role === "project_manager") return user.assignedProjectIds;
  return [];
}

/** نطاق الوصول لوحدة إدارة المشاريع — المحاسب يرى كل المشاريع (عرض فقط) */
export async function getProjectModuleScopedIds(user: SessionUser): Promise<number[] | null> {
  if (user.role === "admin" || user.role === "accountant") return null;
  if ((user.role === "site_supervisor" || user.role === "project_engineer") && user.assignedProjectId) {
    return [user.assignedProjectId];
  }
  if (user.role === "project_manager") return user.assignedProjectIds;
  return [];
}

export function canViewProjectsModule(user: SessionUser): boolean {
  return user.role === "admin" || user.role === "project_manager" || user.role === "site_supervisor" || user.role === "project_engineer" || user.role === "accountant";
}

export function canPickProjectInForms(user: SessionUser): boolean {
  return canViewProjectsModule(user) || user.role === "accountant";
}

export async function assertProjectModuleAccess(
  user: SessionUser,
  projectId?: number,
): Promise<Response | null> {
  if (!canViewProjectsModule(user)) {
    return errorResponse("ليس لديك صلاحية للوصول إلى إدارة المشاريع", 403);
  }
  if (projectId !== undefined) {
    const scoped = await getProjectModuleScopedIds(user);
    if (scoped !== null && !scoped.includes(projectId)) {
      return errorResponse("ليس لديك صلاحية لعرض هذا المشروع", 403);
    }
  }
  return null;
}

export async function authenticateUser(username: string, password: string): Promise<SessionUser | null> {
  const [user] = await db
    .select()
    .from(users)
    .where(or(eq(users.username, username), eq(users.email, username)));

  if (!user?.passwordHash || !user.isActive) return null;
  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) return null;

  const assignedProjectIds =
    user.role === "project_manager" ? await loadAssignedProjectIds(user.id) : [];

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    username: user.username,
    role: user.role,
    department: user.department,
    assignedProjectId: user.assignedProjectId,
    assignedProjectIds,
  };
}

export { COOKIE_NAME };
