import { BASE_MODEL, PIONEER_MODEL, isGatewayConfigured } from "@/lib/gateway/client";

export const MOCK_FALLBACK_MODEL = "mock-fallback";

export type DraftModelRole = "base" | "pioneer";

export type DraftModelOption = {
  id: string;
  label: string;
  roles: DraftModelRole[];
  isDefault: boolean;
};

export type DraftModelConfig = {
  defaultModelId: string;
  fallbackModelId: string;
  gatewayConfigured: boolean;
  models: DraftModelOption[];
};

export function getDraftModelConfig(): DraftModelConfig {
  const models: DraftModelOption[] = [];

  addModel(models, {
    id: PIONEER_MODEL,
    label: "Pioneer",
    roles: ["pioneer"],
    isDefault: true,
  });

  addModel(models, {
    id: BASE_MODEL,
    label: "Base",
    roles: ["base"],
    isDefault: PIONEER_MODEL === BASE_MODEL,
  });

  return {
    defaultModelId: PIONEER_MODEL,
    fallbackModelId: MOCK_FALLBACK_MODEL,
    gatewayConfigured: isGatewayConfigured,
    models,
  };
}

function addModel(models: DraftModelOption[], option: DraftModelOption) {
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
