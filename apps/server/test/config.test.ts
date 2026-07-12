import { describe, expect, it } from 'vitest';

import { loadConfig } from '../src/config';

const required = {
  SLACK_BOT_TOKEN: 'xoxb-test',
  SLACK_APP_TOKEN: 'xapp-test',
  SLACK_SIGNING_SECRET: 'signing-test',
  MCP_BEARER_TOKEN: '0123456789abcdef0123456789abcdef',
};

describe('loadConfig', () => {
  it('uses real-only persistent storage and a local MCP audit path by default', () => {
    expect(loadConfig(required).mcpAuditPath).toBe('data/mcp-audit.jsonl');
    expect(loadConfig(required).databasePath).toBe('data/precedent.db');
  });

  it('rejects the default MCP bearer-token placeholder', () => {
    expect(() => loadConfig({ ...required, MCP_BEARER_TOKEN: 'change-me' })).toThrow(/at least 32 characters/);
  });

  it('passes a non-empty RTS user token to the Slack adapter', () => {
    expect(loadConfig({ ...required, SLACK_USER_TOKEN: 'xoxp-test' }).slack.userToken).toBe('xoxp-test');
  });

  it('uses a managed host PORT when MCP_PORT is not set', () => {
    expect(loadConfig({ ...required, PORT: '8080' }).mcp.port).toBe(8080);
  });
});
