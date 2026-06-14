/**
 * إرسال البريد — حالياً تسجيل في الكونسول
 * لاحقاً: npm install nodemailer + ضبط SMTP_* في Vercel
 */
export async function sendEmail(to: string, subject: string, html: string): Promise<{ ok: boolean; status: string }> {
  console.log(`[EMAIL] To: ${to} | Subject: ${subject}`);
  void html;
  return { ok: true, status: "logged" };
}

export function taskEmailHtml(taskTitle: string, details: string, dueDate: string | null, link: string) {
  return `
    <div dir="rtl" style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
      <h2 style="color:#a67c52">تأهيل الاعمار — مهمة جديدة</h2>
      <p><strong>${taskTitle}</strong></p>
      <p>${details}</p>
      ${dueDate ? `<p>تاريخ الاستحقاق: ${dueDate}</p>` : ""}
      <p><a href="${link}">فتح المهمة</a></p>
    </div>
  `;
}
