import { db } from "./db";
import { notifications, users } from "./schema";
import { eq } from "drizzle-orm";
import { sendEmail, taskEmailHtml } from "./email";

type NotifyInput = {
  userId: number;
  title: string;
  message: string;
  type?: string;
  link?: string;
  sendEmail?: boolean;
  emailSubject?: string;
};

export async function createNotification(input: NotifyInput) {
  const [user] = await db.select().from(users).where(eq(users.id, input.userId));
  let emailStatus: string | null = null;
  let emailSent = false;

  if (input.sendEmail && user?.email) {
    const result = await sendEmail(
      user.email,
      input.emailSubject ?? input.title,
      taskEmailHtml(input.title, input.message, null, input.link ?? process.env.WEB_ORIGIN ?? "http://localhost:3000")
    );
    emailSent = result.ok;
    emailStatus = result.status;
  }

  await db.insert(notifications).values({
    userId: input.userId,
    title: input.title,
    message: input.message,
    type: input.type ?? "info",
    link: input.link ?? null,
    emailSent,
    emailStatus,
  });
}

export async function notifyMany(userIds: number[], input: Omit<NotifyInput, "userId">) {
  for (const userId of [...new Set(userIds)]) {
    await createNotification({ ...input, userId });
  }
}
