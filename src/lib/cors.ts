const ALLOWED_ORIGIN = process.env.WEB_ORIGIN ?? "http://localhost:3000";

export const corsHeaders = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Access-Control-Allow-Credentials": "true",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export function jsonResponse(data: unknown, status = 200) {
  return Response.json(data, { status, headers: corsHeaders });
}

export function errorResponse(message: string, status = 400) {
  return jsonResponse({ error: message }, status);
}

export function emptyResponse(status = 204) {
  return new Response(null, { status, headers: corsHeaders });
}

export function optionsResponse() {
  return emptyResponse();
}
