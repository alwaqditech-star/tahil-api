import { db } from "@/lib/db";
import { tasks, users, projects, contractors } from "@/lib/schema";
import { requireAuth, getScopedProjectIds, type SessionUser } from "@/lib/auth";
import { canCreateTaskFor, canViewAllTasks } from "@/lib/permissions";
import { createNotification } from "@/lib/notify";
import { errorResponse, jsonResponse, optionsResponse } from "@/lib/cors";
import { isDateBefore, todayISO } from "@/lib/dates";
import { eq, desc, and, inArray, or, sql, lt } from "drizzle-orm";

function mapTask(t: typeof tasks.$inferSelect, extras?: Record<string, unknown>) {
  return {
    id: t.id,
    title: t.title,
    description: t.description,
    projectId: t.projectId,
    projectItemId: t.projectItemId,
    contractorId: t.contractorId,
    assigneeId: t.assigneeId,
    createdById: t.createdById,
    priority: t.priority,
    status: t.status,
    startDate: t.startDate,
    dueDate: t.dueDate,
    source: t.source,
    sourceRef: t.sourceRef,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
    ...extras,
  };
}

export async function OPTIONS() {
  return optionsResponse();
}

export async function GET(request: Request) {
  const session = await requireAuth(request);
  if (session instanceof Response) return session;
  const user = session as SessionUser;

  const url = new URL(request.url);
  const status = url.searchParams.get("status");
  const projectId = url.searchParams.get("projectId");
  const mine = url.searchParams.get("mine") === "true";
  const overdue = url.searchParams.get("overdue") === "true";

  let rows = await db.select().from(tasks).orderBy(desc(tasks.createdAt));

  if (!canViewAllTasks(user)) {
    const scoped = await getScopedProjectIds(user);
    rows = rows.filter((t) => {
      if (t.assigneeId === user.id || t.createdById === user.id) return true;
      if (user.role === "project_manager" && t.projectId && scoped?.includes(t.projectId)) return true;
      return false;
    });
  }

  if (mine) rows = rows.filter((t) => t.assigneeId === user.id);
  if (status && status !== "all") rows = rows.filter((t) => t.status === status);
  if (projectId) rows = rows.filter((t) => t.projectId === parseInt(projectId));
  if (overdue) {
    const today = todayISO();
    rows = rows.filter((t) => t.dueDate && isDateBefore(t.dueDate, today) && !["completed", "rejected"].includes(t.status));
  }

  const userIds = [...new Set(rows.flatMap((t) => [t.assigneeId, t.createdById]))];
  const projectIds = [...new Set(rows.map((t) => t.projectId).filter(Boolean))] as number[];
  const contractorIds = [...new Set(rows.map((t) => t.contractorId).filter(Boolean))] as number[];

  const userRows = userIds.length ? await db.select({ id: users.id, name: users.name }).from(users).where(inArray(users.id, userIds)) : [];
  const projectRows = projectIds.length ? await db.select({ id: projects.id, name: projects.name }).from(projects).where(inArray(projects.id, projectIds)) : [];
  const contractorRows = contractorIds.length ? await db.select({ id: contractors.id, name: contractors.name }).from(contractors).where(inArray(contractors.id, contractorIds)) : [];

  const userMap = Object.fromEntries(userRows.map((u) => [u.id, u.name]));
  const projectMap = Object.fromEntries(projectRows.map((p) => [p.id, p.name]));
  const contractorMap = Object.fromEntries(contractorRows.map((c) => [c.id, c.name]));

  return jsonResponse(rows.map((t) => mapTask(t, {
    assigneeName: userMap[t.assigneeId],
    createdByName: userMap[t.createdById],
    projectName: t.projectId ? projectMap[t.projectId] : null,
    contractorName: t.contractorId ? contractorMap[t.contractorId] : null,
  })));
}

export async function POST(request: Request) {
  const session = await requireAuth(request);
  if (session instanceof Response) return session;
  const user = session as SessionUser;
  if (!canCreateTaskFor(user)) return errorResponse("ليس لديك صلاحية إنشاء مهام", 403);

  const body = await request.json();
  if (!body.title || !body.assigneeId) return errorResponse("العنوان والمكلف مطلوبان", 400);

  if (user.role === "project_manager" && body.projectId) {
    const scoped = await getScopedProjectIds(user);
    if (scoped && !scoped.includes(body.projectId)) return errorResponse("المشروع غير مسند إليك", 403);
  }

  await db.insert(tasks).values({
    title: body.title,
    description: body.description ?? null,
    projectId: body.projectId ?? null,
    projectItemId: body.projectItemId ?? null,
    contractorId: body.contractorId ?? null,
    assigneeId: body.assigneeId,
    createdById: user.id,
    priority: body.priority ?? "medium",
    status: "new",
    startDate: body.startDate ?? null,
    dueDate: body.dueDate ?? null,
    source: body.source ?? "manual",
    sourceRef: body.sourceRef ?? null,
  });

  const [created] = await db.select().from(tasks).orderBy(desc(tasks.id)).limit(1);
  const webOrigin = process.env.WEB_ORIGIN ?? "http://localhost:3000";

  await createNotification({
    userId: body.assigneeId,
    title: "مهمة جديدة",
    message: `تم إسناد مهمة: ${body.title}`,
    type: "task",
    link: `${webOrigin}/tasks`,
    sendEmail: true,
    emailSubject: `تأهيل الاعمار — مهمة جديدة: ${body.title}`,
  });

  return jsonResponse(mapTask(created!), 201);
}
