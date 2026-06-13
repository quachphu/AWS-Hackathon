import { NextResponse } from "next/server";
import { getDraftModelConfig } from "@/lib/gateway/models";
import { buildOpenUiPrograms, openUiProgramForPrompt } from "@/lib/openui/programs";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { prompt?: string };
  const prompt = body.prompt?.trim();

  if (!prompt) {
    return NextResponse.json({ error: "prompt is required" }, { status: 400 });
  }

  const modelConfig = getDraftModelConfig();
  const programs = buildOpenUiPrograms(modelConfig);
  const { response, mode } = openUiProgramForPrompt(prompt, programs);

  return NextResponse.json({ response, mode, modelConfig });
}
