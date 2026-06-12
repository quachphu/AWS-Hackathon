import { runTrainingPipelineAgent } from "@/lib/openai/training-pipeline-agent";

export const dynamic = "force-dynamic";

export async function GET() {
  const result = await runTrainingPipelineAgent();
  return Response.json(result);
}
