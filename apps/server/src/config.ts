export interface AppConfig {
  slack: {
    token: string;
    appToken: string;
    signingSecret: string;
    userToken?: string;
  };
  mcp: {
    port: number;
    path: string;
    bearerToken?: string;
    slackSigningSecret: string;
  };
  databasePath: string;
  mcpAuditPath: string;
}

/** Load and validate configuration from the environment. Fails loudly on a missing secret. */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const mcpPort = Number.parseInt(env.MCP_PORT ?? '3010', 10);
  if (!Number.isInteger(mcpPort) || mcpPort < 1) {
    throw new Error(`MCP_PORT must be a positive integer (got "${env.MCP_PORT ?? ''}").`);
  }
  const mcpBearerToken = nonEmpty(env.MCP_BEARER_TOKEN);
  if (mcpBearerToken === undefined || mcpBearerToken === 'change-me' || mcpBearerToken.length < 32) {
    throw new Error('MCP_BEARER_TOKEN must be a strong token of at least 32 characters. Generate one before startup.');
  }
  const slackSigningSecret = required(env, 'SLACK_SIGNING_SECRET');

  return {
    slack: {
      token: required(env, 'SLACK_BOT_TOKEN'),
      appToken: required(env, 'SLACK_APP_TOKEN'),
      signingSecret: slackSigningSecret,
      ...(nonEmpty(env.SLACK_USER_TOKEN) !== undefined ? { userToken: nonEmpty(env.SLACK_USER_TOKEN) } : {}),
    },
    mcp: {
      port: mcpPort,
      path: env.MCP_PATH ?? '/mcp',
      ...(mcpBearerToken !== undefined ? { bearerToken: mcpBearerToken } : {}),
      slackSigningSecret,
    },
    databasePath: env.DATABASE_PATH ?? 'data/precedent.db',
    mcpAuditPath: env.MCP_AUDIT_PATH ?? 'data/mcp-audit.jsonl',
  };
}

function nonEmpty(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed === undefined || trimmed.length === 0 ? undefined : trimmed;
}

function required(env: NodeJS.ProcessEnv, key: string): string {
  const value = env[key];
  if (value === undefined || value.length === 0) {
    throw new Error(`Missing required environment variable ${key}. See .env.example.`);
  }
  return value;
}
