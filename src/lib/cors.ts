const DEFAULT_ORIGINS = ["http://localhost:3000"];

export function getAllowedOrigins(): string[] {
  const raw = process.env.WEB_ORIGINS ?? process.env.WEB_ORIGIN;
  if (!raw) return DEFAULT_ORIGINS;
  return raw.split(",").map((s) => s.trim()).filter(Boolean);
}

export function pickOrigin(requestOrigin: string | null): string {
  const allowed = getAllowedOrigins();
  if (requestOrigin && allowed.includes(requestOrigin)) return requestOrigin;
  return allowed[0] ?? DEFAULT_ORIGINS[0];
}

/** @deprecated استخدم pickOrigin مع Origin من الطلب */
export const corsHeaders = {
  "Access-Control-Allow-Origin": getAllowedOrigins()[0],
  "Access-Control-Allow-Credentials": "true",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export function corsHeadersFor(origin: string | null) {
  return {
    "Access-Control-Allow-Origin": pickOrigin(origin),
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
}

export function jsonResponse(data: unknown, status = 200, origin: string | null = null) {
  return Response.json(data, { status, headers: corsHeadersFor(origin) });
}

export function errorResponse(message: string, status = 400, origin: string | null = null) {
  return jsonResponse({ error: message }, status, origin);
}

export function emptyResponse(status = 204, origin: string | null = null) {
  return new Response(null, { status, headers: corsHeadersFor(origin) });
}

export function optionsResponse(origin: string | null = null) {
  return emptyResponse(204, origin);
}

export function requestOrigin(request: Request): string | null {
  return request.headers.get("origin");
}
