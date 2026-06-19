import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { corsHeadersFor } from "@/lib/cors";
import { applySecurityHeaders } from "@/lib/security-headers";

export function middleware(request: NextRequest) {
  const origin = request.headers.get("origin");
  const headers = corsHeadersFor(origin);

  if (request.method === "OPTIONS") {
    const res = new NextResponse(null, { status: 204, headers });
    applySecurityHeaders(res.headers);
    return res;
  }

  const response = NextResponse.next();
  for (const [key, value] of Object.entries(headers)) {
    response.headers.set(key, value);
  }
  applySecurityHeaders(response.headers);
  return response;
}

export const config = {
  matcher: "/api/:path*",
};
