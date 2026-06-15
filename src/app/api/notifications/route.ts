import { db } from "@/lib/db";
import { notifications } from "@/lib/schema";
import { requireAuth, type SessionUser } from "@/lib/auth";
import { errorResponse, jsonResponse, optionsResponse } from "@/lib/cors";
import { toAppPath } from "@/lib/web-url";
import { eq, desc, and } from "drizzle-orm";

export async function OPTIONS() {
  return optionsResponse();
}

export async function GET(request: Request) {
  const session = await requireAuth(request);
  if (session instanceof Response) return session;
  const user = session as SessionUser;

  const url = new URL(request.url);
  const unreadOnly = url.searchParams.get("unread") === "true";

  const conditions = [eq(notifications.userId, user.id)];
  if (unreadOnly) conditions.push(eq(notifications.isRead, false));

  const rows = await db.select().from(notifications)
    .where(and(...conditions))
    .orderBy(desc(notifications.createdAt))
    .limit(50);

  const unreadCount = rows.filter((r) => !r.isRead).length;

  return jsonResponse({
    items: rows.map((r) => ({ ...r, link: r.link ? toAppPath(r.link) : null })),
    unreadCount,
  });
}

export async function PATCH(request: Request) {
  const session = await requireAuth(request);
  if (session instanceof Response) return session;
  const user = session as SessionUser;
  const body = await request.json();

  if (body.markAllRead) {
    await db.update(notifications).set({ isRead: true }).where(eq(notifications.userId, user.id));
    return jsonResponse({ ok: true });
  }

  if (body.id) {
    await db.update(notifications).set({ isRead: true })
      .where(and(eq(notifications.id, body.id), eq(notifications.userId, user.id)));
    return jsonResponse({ ok: true });
  }

  return errorResponse("طلب غير صالح", 400);
}
