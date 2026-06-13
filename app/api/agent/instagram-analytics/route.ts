import { runInstagramAnalyticsAgent } from "@/lib/openai/instagram-analytics-agent";
import { recordChatHistoryEvent } from "@/lib/analytics/chat-history";

export const dynamic = "force-dynamic";

export async function GET() {
  return analyticsResponse();
}

export async function POST() {
  return analyticsResponse();
}

async function analyticsResponse() {
  const result = await runInstagramAnalyticsAgent();
  await recordChatHistoryEvent({
    sessionId: "visual-remix-demo",
    surface: "instagram",
    eventType: "analytics_pull",
    role: "assistant",
    model: result.model,
    provider: result.provider,
    prompt: "Pull live Instagram analytics from Composio and render the OpenUI artifact.",
    response: result.summary,
    artifactType: "InstagramAnalyticsArtifact",
    artifactProgram: result.program,
    qualityLabel: "instagram_analytics",
    action: "render_instagram_openui",
    mocked: result.mocked || !result.live,
    live: result.live,
    metadata: {
      source: result.snapshot.source,
      agentApiMode: result.agentApiMode,
      toolCalled: result.toolCalled,
      username: result.snapshot.profile.username,
      posts: result.snapshot.posts.length,
    },
  });

  return Response.json({
    live: result.live,
    mocked: result.mocked,
    model: result.model,
    provider: result.provider,
    agentApiMode: result.agentApiMode,
    toolCalled: result.toolCalled,
    summary: result.summary,
    recommendations: result.recommendations,
    program: result.program,
    profile: result.snapshot.profile,
    posts: result.snapshot.posts,
    source: result.snapshot.source,
    generatedAt: result.snapshot.generatedAt,
    error: result.snapshot.error,
  });
}
