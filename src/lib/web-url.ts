const PRODUCTION_WEB = "https://tahil-web.vercel.app";

/** عنوان الواجهة — للبريد والروابط الخارجية */
export function getWebOrigin(): string {
  if (process.env.WEB_ORIGIN) return process.env.WEB_ORIGIN.replace(/\/$/, "");
  const raw = process.env.WEB_ORIGINS;
  if (raw) {
    const first = raw.split(",").map((s) => s.trim()).filter(Boolean)[0];
    if (first) return first.replace(/\/$/, "");
  }
  if (process.env.VERCEL || process.env.NODE_ENV === "production") return PRODUCTION_WEB;
  return "http://localhost:3000";
}

/** مسار نسبي للتخزين في الإشعارات — يعمل على أي استضافة */
export function appPath(path: string): string {
  return path.startsWith("/") ? path : `/${path}`;
}

/** رابط كامل للبريد الإلكتروني */
export function webLink(path: string): string {
  return `${getWebOrigin()}${appPath(path)}`;
}

/** يحوّل رابطاً قديماً (localhost أو كاملاً) إلى مسار نسبي */
export function toAppPath(link: string): string {
  if (link.startsWith("/")) return link;
  try {
    const url = new URL(link);
    return url.pathname + url.search + url.hash;
  } catch {
    return appPath(link);
  }
}
