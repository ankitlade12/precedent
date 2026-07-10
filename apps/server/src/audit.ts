import { appendFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

import type { McpAuditEvent } from '@precedent/mcp-server';

/** Durable, append-only JSONL audit sink for MCP consultations. */
export function createMcpAuditSink(path: string): (event: McpAuditEvent) => void {
  mkdirSync(dirname(path), { recursive: true });
  return (event) => {
    appendFileSync(path, `${JSON.stringify(event)}\n`, { encoding: 'utf8', mode: 0o600 });
    console.log(
      `[mcp-audit] ${event.tool} auth=${event.authSource ?? 'unknown'} user=${event.slackUserId ?? 'not-provided'} outcome=${JSON.stringify(event.outcome)}`,
    );
  };
}
