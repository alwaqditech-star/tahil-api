import { db } from "@/lib/db";
import { projects, expenses, extracts, tasks, users, projectAssignments } from "@/lib/schema";
import { requireAuth, type SessionUser } from "@/lib/auth";
import { canRunSmartTasks } from "@/lib/permissions";
import { createNotification } from "@/lib/notify";
import { appPath } from "@/lib/web-url";
import { jsonResponse, optionsResponse } from "@/lib/cors";
import { isDateBefore, todayDateOnly, todayISO } from "@/lib/dates";
import { eq, and, sql, desc } from "drizzle-orm";

export async function OPTIONS() {
  return optionsResponse();
}

/** إنشاء مهام تلقائية — للإدارة والمحاسب */
export async function POST(request: Request) {
  const session = await requireAuth(request);
  if (session instanceof Response) return session;
  const user = session as SessionUser;
  if (!canRunSmartTasks(user)) return jsonResponse({ error: "ليس لديك صلاحية" }, 403);

  const today = todayDateOnly();
  const todayStr = todayISO();
  let created = 0;

  const allProjects = await db.select().from(projects).where(eq(projects.status, "active"));
  const managers = await db.select().from(users).where(and(eq(users.role, "project_manager"), eq(users.isActive, true)));
  const accountants = await db.select().from(users).where(and(eq(users.role, "accountant"), eq(users.isActive, true)));

  for (const p of allProjects) {
    if (p.endDate && isDateBefore(p.endDate, todayStr)) {
      const [assignments] = await db.select().from(projectAssignments).where(eq(projectAssignments.projectId, p.id)).limit(1);
      const assigneeId = assignments?.userId ?? managers[0]?.id;
      if (!assigneeId) continue;

      const exists = await db.select().from(tasks).where(and(
        eq(tasks.projectId, p.id),
        eq(tasks.source, "auto"),
        eq(tasks.sourceRef, "delayed_project"),
        sql`${tasks.status} NOT IN ('completed','rejected')`
      )).limit(1);
      if (exists.length) continue;

      await db.insert(tasks).values({
        title: `متابعة تأخر المشروع: ${p.name}`,
        description: `المشروع متأخر عن تاريخ الانتهاء ${p.endDate}`,
        projectId: p.id,
        assigneeId,
        createdById: user.id,
        priority: "high",
        status: "new",
        source: "auto",
        sourceRef: "delayed_project",
        dueDate: today,
      });
      await createNotification({ userId: assigneeId, title: "مهمة تلقائية", message: `تأخر مشروع ${p.name}`, type: "task", link: appPath("/tasks") });
      created++;
    }

    const budget = Number(p.budgetAllocated);
    const [expSum] = await db.select({ total: sql<string>`COALESCE(SUM(${expenses.amount}), 0)` }).from(expenses).where(and(eq(expenses.projectId, p.id), eq(expenses.status, "approved")));
    if (budget > 0 && Number(expSum?.total ?? 0) > budget * 0.9) {
      const assigneeId = accountants[0]?.id ?? managers[0]?.id;
      if (!assigneeId) continue;
      const exists = await db.select().from(tasks).where(and(eq(tasks.projectId, p.id), eq(tasks.sourceRef, "budget_warning"), sql`${tasks.status} NOT IN ('completed','rejected')`)).limit(1);
      if (exists.length) continue;
      await db.insert(tasks).values({
        title: `تحذير تجاوز الميزانية: ${p.name}`,
        description: `المصروفات المعتمدة تجاوزت 90% من الميزانية`,
        projectId: p.id,
        assigneeId,
        createdById: user.id,
        priority: "urgent",
        status: "new",
        source: "auto",
        sourceRef: "budget_warning",
        dueDate: today,
      });
      created++;
    }
  }

  const [oldPending] = await db.select({ count: sql<number>`COUNT(*)` }).from(expenses).where(and(eq(expenses.status, "pending"), sql`${expenses.createdAt} < DATE_SUB(NOW(), INTERVAL 7 DAY)`));
  if (Number(oldPending?.count ?? 0) > 0 && managers[0]) {
    await db.insert(tasks).values({
      title: "مصروفات معلقة منذ أكثر من أسبوع",
      description: `${oldPending?.count} مصروف بانتظار الاعتماد`,
      assigneeId: managers[0].id,
      createdById: user.id,
      priority: "medium",
      status: "new",
      source: "auto",
      sourceRef: "pending_expenses",
      dueDate: today,
    });
    created++;
  }

  const [pendingExt] = await db.select({ count: sql<number>`COUNT(*)` }).from(extracts).where(sql`${extracts.status} IN ('submitted','manager_approved')`);
  if (Number(pendingExt?.count ?? 0) > 0 && accountants[0]) {
    await db.insert(tasks).values({
      title: "مستخلصات بانتظار الاعتماد",
      description: `${pendingExt?.count} مستخلص يحتاج مراجعة`,
      assigneeId: accountants[0].id,
      createdById: user.id,
      priority: "medium",
      status: "new",
      source: "auto",
      sourceRef: "pending_extracts",
      dueDate: today,
    });
    created++;
  }

  return jsonResponse({ created });
}
