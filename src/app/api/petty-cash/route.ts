import { db } from "@/lib/db";
import { pettyCash, projects, users } from "@/lib/schema";
import { requireAuth, requireRole, type SessionUser } from "@/lib/auth";
import { PETTY_CASH_RECIPIENT_ROLES } from "@/lib/permissions";
import { createNotification } from "@/lib/notify";
import { appPath } from "@/lib/web-url";
import { errorResponse, jsonResponse, optionsResponse } from "@/lib/cors";
import { eq, desc, and, or, inArray } from "drizzle-orm";

function mapRow(r: typeof pettyCash.$inferSelect, projectName?: string) {
  return {
    id: r.id, projectId: r.projectId, projectName,
    assignedTo: r.assignedTo, assignedToId: r.assignedToId,
    issuedById: r.issuedById, purpose: r.purpose,
    allocatedAmount: Number(r.allocatedAmount), usedAmount: Number(r.usedAmount),
    remaining: Number(r.allocatedAmount) - Number(r.usedAmount),
    status: r.status, issuedDate: r.issuedDate, settledDate: r.settledDate,
    settledById: r.settledById, notes: r.notes, createdAt: r.createdAt,
  };
}

export async function OPTIONS() {
  return optionsResponse();
}

export async function GET(request: Request) {
  const session = await requireAuth(request);
  if (session instanceof Response) return session;
  const user = session as SessionUser;

  let rows = await db.select().from(pettyCash).orderBy(desc(pettyCash.createdAt));

  // العهد على مستوى الموظف — الميدان يرى عهدته فقط
  if (user.role === "project_manager" || user.role === "site_supervisor" || user.role === "project_engineer") {
    rows = rows.filter((r) => r.assignedToId === user.id);
  }

  const projectIds = [...new Set(rows.map((r) => r.projectId).filter(Boolean))] as number[];
  const projectRows = projectIds.length
    ? await db.select({ id: projects.id, name: projects.name }).from(projects).where(inArray(projects.id, projectIds))
    : [];
  const projectMap = Object.fromEntries(projectRows.map((p) => [p.id, p.name]));

  return jsonResponse(rows.map((r) => mapRow(r, r.projectId ? projectMap[r.projectId] : undefined)));
}

export async function POST(request: Request) {
  const session = await requireAuth(request);
  if (session instanceof Response) return session;
  const user = session as SessionUser;
  // صرف العهد: المحاسب فقط
  if (!requireRole(user, "admin", "accountant")) {
    return errorResponse("صرف العهد متاح للمحاسب فقط", 403);
  }

  const body = await request.json();

  // التحقق من المستلم (مدير مشاريع أو مشرف موقع)
  const [recipient] = await db.select().from(users).where(eq(users.id, body.assignedToId));
  if (!recipient || !PETTY_CASH_RECIPIENT_ROLES.includes(recipient.role)) {
    return errorResponse("المستلم يجب أن يكون مدير مشاريع أو مشرف موقع أو مهندس مشروع", 400);
  }

  await db.insert(pettyCash).values({
    projectId: body.projectId ?? null,
    assignedTo: recipient.name,
    assignedToId: recipient.id,
    issuedById: user.id,
    purpose: body.purpose,
    allocatedAmount: String(body.allocatedAmount ?? 0),
    usedAmount: "0",
    status: "open",
    issuedDate: body.issuedDate ?? new Date().toISOString().slice(0, 10),
    notes: body.notes,
  });

  const [created] = await db.select().from(pettyCash).orderBy(desc(pettyCash.id)).limit(1);

  await createNotification({
    userId: recipient.id,
    title: "عهدة جديدة",
    message: `تم إصدار عهدة "${body.purpose}" بمبلغ ${body.allocatedAmount} ر.س`,
    type: "petty_cash",
    link: appPath("/petty-cash"),
    sendEmail: true,
  });

  return jsonResponse(mapRow(created!), 201);
}
