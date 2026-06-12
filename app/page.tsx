import { OpenUIStudio } from "@/components/openui/OpenUIStudio";
import { getDraftModelConfig } from "@/lib/gateway/models";
import { buildOpenUiPrograms } from "@/lib/openui/programs";

export const dynamic = "force-dynamic";

export default function Home() {
  const modelConfig = getDraftModelConfig();
  const programs = buildOpenUiPrograms(modelConfig);

  return <OpenUIStudio initialModelConfig={modelConfig} initialPrograms={programs} />;
}
