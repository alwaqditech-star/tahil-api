import { db } from "@/lib/db";
import { projectItems } from "@/lib/schema";
import { requireAuth, type SessionUser } from "@/lib/auth";
import { canEditResource, canDeleteResource } from "@/lib/permissions";
import { errorResponse, jsonResponse, optionsResponse, emptyResponse } from "@/lib/cors";
import { eq } from "drizzle-orm";

export async function OPTIONS() {
  return optionsResponse();
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAuth(request);
  if (session instanceof Response) return session;
  const user = session as SessionUser;
  if (!canEditResource(user, "projectItems")) return errorResponse("ليس لديك صلاحية", 403);

  const { id } = await params;
  const body = await request.json();

  await db.update(projectItems).set({
    name: body.name, unit: body.unit,
    unitPrice: String(body.unitPrice ?? 0),
    estimatedPrice: String(body.estimatedPrice ?? 0),
    executedPrice: String(body.executedPrice ?? 0),
    quantity: String(body.quantity ?? 1),
    updatedAt: new Date(),
  }).where(eq(projectItems.id, parseInt(id)));

  const [row] = await db.select().from(projectItems).where(eq(projectItems.id, parseInt(id)));
  return jsonResponse(row);
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAuth(request);
  if (session instanceof Response) return session;
  const user = session as SessionUser;
  if (!canDeleteResource(user)) return errorResponse("ليس لديك صلاحية", 403);

  const { id } = await params;
  await db.delete(projectItems).where(eq(projectItems.id, parseInt(id)));
  return emptyResponse();
}
