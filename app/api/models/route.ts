import { NextResponse } from "next/server";
import { getDraftModelConfig } from "@/lib/gateway/models";

export function GET() {
  return NextResponse.json(getDraftModelConfig());
}
