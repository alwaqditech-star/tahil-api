import { jsonResponse, optionsResponse } from "@/lib/cors";

export async function OPTIONS() {
  return optionsResponse();
}

export async function GET() {
  return jsonResponse({ status: "ok", service: "Jade ERP API" });
}
