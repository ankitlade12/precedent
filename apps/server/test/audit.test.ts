import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { McpAuditEvent } from '@precedent/mcp-server';
import { describe, expect, it } from 'vitest';

import { createMcpAuditSink } from '../src/audit';

describe('createMcpAuditSink', () => {
  it('appends structured invocation events as JSONL', () => {
    const directory = mkdtempSync(join(tmpdir(), 'precedent-audit-'));
    const path = join(directory, 'mcp.jsonl');
    const event: McpAuditEvent = {
      timestamp: '2026-07-10T00:00:00.000Z',
      tool: 'has_this_been_decided',
      authSource: 'slack_signature',
      slackUserId: 'U123',
      slackTeamId: 'T123',
      input: { topic: 'primary datastore', channelId: 'C123' },
      outcome: { decided: true, currentId: 'DR-current', historyCount: 2 },
    };
    try {
      createMcpAuditSink(path)(event);
      expect(JSON.parse(readFileSync(path, 'utf8').trim())).toEqual(event);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
