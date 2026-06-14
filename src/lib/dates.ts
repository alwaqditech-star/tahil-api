/** تحويل نص YYYY-MM-DD أو Date لحقل date في Drizzle/MySQL */
export function toDateOnly(value: string | Date | null | undefined): Date | null {
  if (value == null || value === "") return null;
  if (value instanceof Date) return value;
  return new Date(`${String(value).slice(0, 10)}T00:00:00.000Z`);
}

export function todayDateOnly(): Date {
  return toDateOnly(new Date().toISOString().slice(0, 10))!;
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

/** مقارنة تاريخين (date فقط) — a قبل b؟ */
export function isDateBefore(
  a: string | Date | null | undefined,
  b: string | Date | null | undefined,
): boolean {
  const sa = a instanceof Date ? a.toISOString().slice(0, 10) : a ? String(a).slice(0, 10) : null;
  const sb = b instanceof Date ? b.toISOString().slice(0, 10) : b ? String(b).slice(0, 10) : null;
  if (!sa || !sb) return false;
  return sa < sb;
}
