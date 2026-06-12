import { getRuntimeModelConfig } from "@/lib/gateway/models";

export const dynamic = "force-dynamic";

export function GET() {
  return Response.json(getRuntimeModelConfig());
}
