"use client";

import { useState } from "react";
import { Renderer, type OpenUIError } from "@openuidev/react-lang";
import { adFactoryOpenUiLibrary } from "@/components/openui/ad-factory-library";
import {
  ANALYTICS_OPENUI_PROGRAM,
  DEFAULT_OPENUI_PROGRAM,
  DEV_LOOP_OPENUI_PROGRAM,
} from "@/lib/openui/programs";

type ProgramMode = "default" | "analytics" | "dev";

const cannedPrograms: Record<ProgramMode, string> = {
  default: DEFAULT_OPENUI_PROGRAM,
  analytics: ANALYTICS_OPENUI_PROGRAM,
  dev: DEV_LOOP_OPENUI_PROGRAM,
};

export function OpenUIStudio() {
  const [mode, setMode] = useState<ProgramMode>("default");
  const [prompt, setPrompt] = useState("Show Pioneer cost versus base model and TikTok fit.");
  const [program, setProgram] = useState(DEFAULT_OPENUI_PROGRAM);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<OpenUIError[]>([]);

  function chooseProgram(nextMode: ProgramMode) {
    setMode(nextMode);
    setProgram(cannedPrograms[nextMode]);
    setErrors([]);
  }

  async function generateProgram() {
    if (!prompt.trim() || loading) return;
    setLoading(true);
    setErrors([]);

    try {
      const res = await fetch("/api/openui/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      if (!res.ok) throw new Error(`OpenUI generation failed (${res.status})`);
      const body = (await res.json()) as { response: string; mode: ProgramMode };
      setMode(body.mode);
      setProgram(body.response);
    } catch (error) {
      setErrors([
        {
          source: "parser",
          code: "parse-exception",
          message: error instanceof Error ? error.message : "OpenUI generation failed",
          hint: "The mock generator route should return an OpenUI Lang response.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f6f1eb]">
      <div className="border-b border-[#ddd4c9] bg-[#221914] px-5 py-3 text-white">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-3">
          <div className="mr-auto">
            <p className="text-xs uppercase tracking-[0.2em] text-[#d9a074]">OpenUI control surface</p>
            <h1 className="text-sm font-semibold">Stored default UI + generated analytics</h1>
          </div>
          <div className="flex rounded-lg border border-white/10 bg-white/5 p-1">
            <ModeButton active={mode === "default"} onClick={() => chooseProgram("default")}>
              Default
            </ModeButton>
            <ModeButton active={mode === "analytics"} onClick={() => chooseProgram("analytics")}>
              Analytics
            </ModeButton>
            <ModeButton active={mode === "dev"} onClick={() => chooseProgram("dev")}>
              Dev loop
            </ModeButton>
          </div>
          <div className="flex min-w-[320px] flex-1 items-center gap-2 sm:max-w-xl">
            <input
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              onKeyDown={(event) => event.key === "Enter" && void generateProgram()}
              className="h-9 min-w-0 flex-1 rounded-md border border-white/15 bg-white/10 px-3 text-sm text-white outline-none placeholder:text-white/35 focus:border-[#d9a074]"
              placeholder="Ask for OpenUI analytics or dev-loop status"
            />
            <button
              onClick={() => void generateProgram()}
              disabled={loading || !prompt.trim()}
              className="h-9 rounded-md bg-[#d98045] px-3 text-sm font-semibold text-white hover:bg-[#ef965a] disabled:opacity-45"
            >
              {loading ? "Generating" : "Generate UI"}
            </button>
          </div>
        </div>
        {errors.length > 0 ? (
          <div className="mx-auto mt-2 max-w-[1600px] rounded-md border border-red-300/30 bg-red-950/35 px-3 py-2 text-xs text-red-100">
            {errors[0]?.message}
          </div>
        ) : null}
      </div>

      <Renderer
        library={adFactoryOpenUiLibrary}
        response={program}
        isStreaming={loading}
        onError={setErrors}
      />
    </main>
  );
}

function ModeButton({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={[
        "rounded-md px-3 py-1.5 text-xs font-semibold transition",
        active ? "bg-white text-[#221914]" : "text-white/68 hover:bg-white/10 hover:text-white",
      ].join(" ")}
    >
      {children}
    </button>
  );
}
