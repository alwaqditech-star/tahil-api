import { db } from "@/lib/db";
import { tasks } from "@/lib/schema";
import { requireAuth, getScopedProjectIds, type SessionUser } from "@/lib/auth";
import { canDeleteResource, canManageTask } from "@/lib/permissions";
import { createNotification } from "@/lib/notify";
import { appPath } from "@/lib/web-url";
import { errorResponse, jsonResponse, optionsResponse, emptyResponse } from "@/lib/cors";
import { eq } from "drizzle-orm";

export async function OPTIONS() {
  return optionsResponse();
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAuth(request);
  if (session instanceof Response) return session;
  const user = session as SessionUser;
  const { id } = await params;

  const [task] = await db.select().from(tasks).where(eq(tasks.id, parseInt(id)));
  if (!task) return errorResponse("غير موجود", 404);

  const scoped = user.role === "project_manager" ? await getScopedProjectIds(user) ?? [] : [];
  if (!canManageTask(user, task, scoped) && user.role !== "admin" && user.role !== "accountant") {
    return errorResponse("ليس لديك صلاحية", 403);
  }

  return jsonResponse(task);
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAuth(request);
  if (session instanceof Response) return session;
  const user = session as SessionUser;
  const { id } = await params;
  const body = await request.json();

  const [task] = await db.select().from(tasks).where(eq(tasks.id, parseInt(id)));
  if (!task) return errorResponse("غير موجود", 404);

  const scoped = user.role === "project_manager" ? await getScopedProjectIds(user) ?? [] : [];
  if (!canManageTask(user, task, scoped)) return errorResponse("ليس لديك صلاحية", 403);

  await db.update(tasks).set({
    title: body.title ?? task.title,
    description: body.description ?? task.description,
    projectId: body.projectId ?? task.projectId,
    projectItemId: body.projectItemId ?? task.projectItemId,
    contractorId: body.contractorId ?? task.contractorId,
    assigneeId: body.assigneeId ?? task.assigneeId,
    priority: body.priority ?? task.priority,
    startDate: body.startDate ?? task.startDate,
    dueDate: body.dueDate ?? task.dueDate,
    updatedAt: new Date(),
  }).where(eq(tasks.id, parseInt(id)));

  const [row] = await db.select().from(tasks).where(eq(tasks.id, parseInt(id)));
  return jsonResponse(row);
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAuth(request);
  if (session instanceof Response) return session;
  const user = session as SessionUser;
  const { id } = await params;
  const body = await request.json();

  const [task] = await db.select().from(tasks).where(eq(tasks.id, parseInt(id)));
  if (!task) return errorResponse("غير موجود", 404);

  const scoped = user.role === "project_manager" ? await getScopedProjectIds(user) ?? [] : [];
  const isAssignee = task.assigneeId === user.id;
  const canManage = canManageTask(user, task, scoped);

  if (!canManage && !isAssignee) return errorResponse("ليس لديك صلاحية", 403);

  const newStatus = body.status as string;
  const valid = ["new", "in_progress", "review", "completed", "rejected"];
  if (!valid.includes(newStatus)) return errorResponse("حالة غير صالحة", 400);

  await db.update(tasks).set({ status: newStatus, updatedAt: new Date() }).where(eq(tasks.id, parseInt(id)));

  if (newStatus === "review" && task.createdById !== user.id) {
    await createNotification({
      userId: task.createdById,
      title: "مهمة بانتظار المراجعة",
      message: `المهمة "${task.title}" جاهزة للمراجعة`,
      type: "task",
      link: appPath("/tasks"),
    });
  }

  const [row] = await db.select().from(tasks).where(eq(tasks.id, parseInt(id)));
  return jsonResponse(row);
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAuth(request);
  if (session instanceof Response) return session;
  const user = session as SessionUser;
  if (!canDeleteResource(user)) return errorResponse("ليس لديك صلاحية", 403);

  const { id } = await params;
  await db.delete(tasks).where(eq(tasks.id, parseInt(id)));
  return emptyResponse();
}
