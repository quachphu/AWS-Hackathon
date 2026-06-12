import { runInstagramAnalyticsAgent } from "@/lib/openai/instagram-analytics-agent";

export const dynamic = "force-dynamic";

export async function GET() {
  return analyticsResponse();
}

export async function POST() {
  return analyticsResponse();
}

async function analyticsResponse() {
  const result = await runInstagramAnalyticsAgent();

  return Response.json({
    live: result.live,
    mocked: result.mocked,
    model: result.model,
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
