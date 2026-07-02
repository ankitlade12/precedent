export interface AppConfig {
  slack: {
    token: string;
    appToken: string;
    signingSecret: string;
  };
  mcp: {
    port: number;
    path: string;
    bearerToken?: string;
  };
  databasePath: string;
}

/** Load and validate configuration from the environment. Fails loudly on a missing secret. */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const mcpPort = Number.parseInt(env.MCP_PORT ?? '3010', 10);
  if (!Number.isInteger(mcpPort) || mcpPort < 1) {
    throw new Error(`MCP_PORT must be a positive integer (got "${env.MCP_PORT ?? ''}").`);
  }

  return {
    slack: {
      token: required(env, 'SLACK_BOT_TOKEN'),
      appToken: required(env, 'SLACK_APP_TOKEN'),
      signingSecret: required(env, 'SLACK_SIGNING_SECRET'),
    },
    mcp: {
      port: mcpPort,
      path: env.MCP_PATH ?? '/mcp',
      ...(env.MCP_BEARER_TOKEN !== undefined ? { bearerToken: env.MCP_BEARER_TOKEN } : {}),
    },
    databasePath: env.DATABASE_PATH ?? 'data/precedent.db',
  };
}

function required(env: NodeJS.ProcessEnv, key: string): string {
  const value = env[key];
  if (value === undefined || value.length === 0) {
    throw new Error(`Missing required environment variable ${key}. See .env.example.`);
  }
  return value;
}
