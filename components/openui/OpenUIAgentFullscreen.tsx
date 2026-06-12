"use client";

import { openAIMessageFormat, openAIResponsesAdapter } from "@openuidev/react-headless";
import { FullScreen } from "@openuidev/react-ui";
import { BarChart3, Image as ImageIcon, Sparkles, Video } from "lucide-react";
import { janusOpenUiLibrary } from "@/components/openui/janus-openui-library";

export function OpenUIAgentFullscreen() {
  return (
    <main className="h-screen bg-[#f7f6f4]">
      <FullScreen
        apiUrl="/api/agent/chat"
        agentName="Harness Remix Agent"
        showAssistantLogo={false}
        streamProtocol={openAIResponsesAdapter()}
        messageFormat={openAIMessageFormat}
        componentLibrary={janusOpenUiLibrary}
        welcomeMessage={{
          title: "Harness Remix Agent",
          description: "OpenUI fullscreen chat for prompt, analytics, and generative UI passes.",
        }}
        conversationStarters={{
          variant: "short",
          options: [
            {
              displayText: "Improve image prompt",
              prompt: "Improve the locked-character image prompt for the hackathon remix.",
              icon: <ImageIcon className="h-4 w-4" />,
            },
            {
              displayText: "Plan video cut",
              prompt: "Turn this image direction into a short TikTok video cut list.",
              icon: <Video className="h-4 w-4" />,
            },
            {
              displayText: "Score TikTok fit",
              prompt: "Score the remix for TikTok fit, hook strength, and publish risk.",
              icon: <Sparkles className="h-4 w-4" />,
            },
            {
              displayText: "Instagram analytics",
              prompt: "Pull live Instagram analytics from Composio and render the OpenUI artifact.",
              icon: <BarChart3 className="h-4 w-4" />,
            },
          ],
        }}
      />
    </main>
  );
}
