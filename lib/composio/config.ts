export type ComposioToolkit = "instagram" | "tiktok";

const DEFAULT_COMPOSIO_USER_ID = "ad-factory-demo-user";

export function getComposioApiKey() {
  return process.env.COMPOSIO_API_KEY ?? process.env.COMPOSIO_API ?? "";
}

export function getComposioExecutionUserId() {
  return (
    process.env.COMPOSIO_EXECUTION_USER_ID ??
    process.env.COMPOSIO_CONNECTED_ACCOUNT_USER_ID ??
    process.env.COMPOSIO_ENTITY_ID ??
    process.env.COMPOSIO_USER_ID ??
    DEFAULT_COMPOSIO_USER_ID
  );
}

export function getComposioConnectedAccountId(toolkit: ComposioToolkit) {
  if (toolkit === "instagram") {
    return process.env.COMPOSIO_INSTAGRAM_CONNECTED_ACCOUNT_ID ?? process.env.COMPOSIO_CONNECTED_ACCOUNT_ID;
  }

  return process.env.COMPOSIO_TIKTOK_CONNECTED_ACCOUNT_ID;
}

export function getComposioToolExecutionCommon(toolkit: ComposioToolkit) {
  const connectedAccountId = getComposioConnectedAccountId(toolkit);

  return {
    userId: getComposioExecutionUserId(),
    ...(connectedAccountId ? { connectedAccountId } : {}),
    dangerouslySkipVersionCheck: true,
  };
}
