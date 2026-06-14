/**
 * إرسال البريد — يعمل عند ضبط SMTP_* في .env.local
 * وإلا يُسجّل في الكونسول فقط (وضع التطوير)
 */
export async function sendEmail(to: string, subject: string, html: string): Promise<{ ok: boolean; status: string }> {
  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM ?? "noreply@jade-erp.sa";

  if (!host || !user || !pass) {
    console.log(`[EMAIL-DEV] To: ${to} | Subject: ${subject}`);
    return { ok: true, status: "dev_logged" };
  }

  try {
    const nodemailer = await import("nodemailer").catch(() => null);
    if (!nodemailer) {
      console.log(`[EMAIL] nodemailer غير مثبت — To: ${to} | ${subject}`);
      return { ok: false, status: "no_mailer" };
    }
    const transporter = nodemailer.createTransport({
      host,
      port: Number(port ?? 587),
      secure: port === "465",
      auth: { user, pass },
    });
    await transporter.sendMail({ from, to, subject, html });
    return { ok: true, status: "sent" };
  } catch (err) {
    console.error("[EMAIL]", err);
    return { ok: false, status: "failed" };
  }
}

export function taskEmailHtml(taskTitle: string, details: string, dueDate: string | null, link: string) {
  return `
    <div dir="rtl" style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
      <h2 style="color:#a67c52">تأهيل الاعمار — مهمة جديدة</h2>
      <p><strong>${taskTitle}</strong></p>
      <p>${details}</p>
      ${dueDate ? `<p>تاريخ الاستحقاق: ${dueDate}</p>` : ""}
      <p><a href="${link}" style="background:#10b981;color:#fff;padding:10px 20px;text-decoration:none;border-radius:8px">فتح المهمة</a></p>
    </div>
  `;
}
