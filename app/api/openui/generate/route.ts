import { NextResponse } from "next/server";
import {
  ANALYTICS_OPENUI_PROGRAM,
  DEFAULT_OPENUI_PROGRAM,
  DEV_LOOP_OPENUI_PROGRAM,
  openUiProgramForPrompt,
} from "@/lib/openui/programs";

type ProgramMode = "default" | "analytics" | "dev";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { prompt?: string };
  const prompt = body.prompt?.trim();

  if (!prompt) {
    return NextResponse.json({ error: "prompt is required" }, { status: 400 });
  }

  const response = openUiProgramForPrompt(prompt);
  return NextResponse.json({ response, mode: modeForProgram(response) });
}

function modeForProgram(response: string): ProgramMode {
  if (response === ANALYTICS_OPENUI_PROGRAM) return "analytics";
  if (response === DEV_LOOP_OPENUI_PROGRAM) return "dev";
  if (response === DEFAULT_OPENUI_PROGRAM) return "default";
  return "default";
}
