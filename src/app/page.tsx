import { redirect } from "next/navigation";

export default function ApiHome() {
  redirect("/api/healthz");
}
