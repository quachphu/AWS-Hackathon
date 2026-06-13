import { BASE_MODEL, PIONEER_MODEL, isGatewayConfigured } from "@/lib/gateway/client";
import { getAgentApiMode, getAgentModel, getAgentProvider } from "@/lib/openai/remix-agent";

export const MOCK_FALLBACK_MODEL = "mock-fallback";

export type DraftModelRole = "base" | "pioneer";

export type DraftModelOption = {
  id: string;
  label: string;
  roles: DraftModelRole[];
  isDefault: boolean;
};

export type RuntimeModelConfig = {
  draft: {
    defaultModelId: string;
    fallbackModelId: string;
    gatewayConfigured: boolean;
    models: DraftModelOption[];
  };
  agent: {
    modelId: string;
    provider: "truefoundry" | "openai";
    apiMode: "chat_completions" | "responses";
    gatewayConfigured: boolean;
  };
};

export type DraftModelConfig = RuntimeModelConfig["draft"];

export function getRuntimeModelConfig(): RuntimeModelConfig {
  const draftModels: DraftModelOption[] = [];

  addDraftModel(draftModels, {
    id: PIONEER_MODEL,
    label: "Pioneer",
    roles: ["pioneer"],
    isDefault: true,
  });

  addDraftModel(draftModels, {
    id: BASE_MODEL,
    label: "Base",
    roles: ["base"],
    isDefault: PIONEER_MODEL === BASE_MODEL,
  });

  return {
    draft: {
      defaultModelId: PIONEER_MODEL,
      fallbackModelId: MOCK_FALLBACK_MODEL,
      gatewayConfigured: isGatewayConfigured,
      models: draftModels,
    },
    agent: {
      modelId: getAgentModel(),
      provider: getAgentProvider(),
      apiMode: getAgentApiMode(),
      gatewayConfigured: isGatewayConfigured,
    },
  };
}

export function getDraftModelConfig(): DraftModelConfig {
  return getRuntimeModelConfig().draft;
}

function addDraftModel(models: DraftModelOption[], option: DraftModelOption) {
  const existing = models.find((model) => model.id === option.id);
  if (!existing) {
    models.push(option);
    return;
  }

  existing.roles = Array.from(new Set([...existing.roles, ...option.roles]));
  existing.label = existing.roles.map(roleLabel).join(" + ");
  existing.isDefault = existing.isDefault || option.isDefault;
}

function roleLabel(role: DraftModelRole) {
  return role === "pioneer" ? "Pioneer" : "Base";
}
