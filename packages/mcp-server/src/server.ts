import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { Ledger } from '@precedent/ledger-core';
import { z } from 'zod';

import { getDecision, hasThisBeenDecided, listDecisions } from './tools';

export interface McpAuditEvent {
  timestamp: string;
  tool: 'has_this_been_decided' | 'get_decision' | 'list_decisions';
  authSource?: 'slack_signature' | 'bearer';
  slackUserId?: string;
  slackTeamId?: string;
  input: Record<string, string | undefined>;
  outcome: Record<string, string | number | boolean | undefined>;
}

export interface McpServerOptions {
  audit?: (event: McpAuditEvent) => void | Promise<void>;
  now?: () => Date;
  authSource?: 'slack_signature' | 'bearer';
}

/**
 * Precedent's own MCP server.
 *
 * This is the move that changes the category from "an agent" to "the memory layer
 * other agents consult": any agent in the workspace can call
 * `has_this_been_decided()` before it acts and get back the current decision, its
 * supersession history, and the source permalinks. The transport (Streamable HTTP)
 * is attached by the composition root; this factory just wires the tools to the
 * deterministic ledger.
 */
export function createMcpServer(ledger: Ledger, options: McpServerOptions = {}): McpServer {
  const server = new McpServer({ name: 'precedent', version: '0.1.0' });

  server.registerTool(
    'has_this_been_decided',
    {
      title: 'Check team precedent',
      description:
        'Use before proposing or acting on a team choice. Checks whether the topic was decided and returns the authoritative CURRENT decision, replaced history, rejected alternatives, and Slack source receipts.',
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
      inputSchema: {
        topic: z.string().describe('The question or topic to check, e.g. "auth provider" or "primary datastore".'),
        channelId: z.string().optional().describe('Optional Slack channel ID to constrain the result for least-privilege recall.'),
      },
    },
    async ({ topic, channelId }, extra) => {
      const result = hasThisBeenDecided(ledger, topic, channelId);
      await emitAudit(options, extra, {
        tool: 'has_this_been_decided',
        input: { topic, channelId },
        outcome: { decided: result.decided, currentId: result.current?.id, historyCount: result.history.length },
      });
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.registerTool(
    'get_decision',
    {
      title: 'Get one decision record',
      description: 'Fetch a single decision record by id (e.g. DR-a1b2c3d4e5f6).',
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
      inputSchema: { id: z.string().describe('A decision id.') },
    },
    async ({ id }, extra) => {
      const decision = getDecision(ledger, id);
      await emitAudit(options, extra, {
        tool: 'get_decision',
        input: { id },
        outcome: { found: decision !== undefined, currentStatus: decision?.status },
      });
      return {
        content: [{ type: 'text' as const, text: decision ? JSON.stringify(decision, null, 2) : `No decision ${id}.` }],
      };
    },
  );

  server.registerTool(
    'list_decisions',
    {
      title: 'List current team decisions',
      description: 'List all current (non-superseded) decisions in the ledger.',
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
      inputSchema: {
        channelId: z.string().optional().describe('Optional Slack channel ID to constrain the list.'),
      },
    },
    async ({ channelId }, extra) => {
      const decisions = listDecisions(ledger, channelId);
      await emitAudit(options, extra, {
        tool: 'list_decisions',
        input: { channelId },
        outcome: { count: decisions.length },
      });
      return { content: [{ type: 'text' as const, text: JSON.stringify(decisions, null, 2) }] };
    },
  );

  return server;
}

async function emitAudit(
  options: McpServerOptions,
  extra: unknown,
  event: Omit<McpAuditEvent, 'timestamp' | 'slackUserId' | 'slackTeamId'>,
): Promise<void> {
  if (options.audit === undefined) return;
  const slack = (extra as { _meta?: { slack?: { user_id?: string; team_id?: string } } })._meta?.slack;
  const complete: McpAuditEvent = {
    timestamp: (options.now ?? (() => new Date()))().toISOString(),
    ...event,
    ...(options.authSource !== undefined ? { authSource: options.authSource } : {}),
    ...(slack?.user_id !== undefined ? { slackUserId: slack.user_id } : {}),
    ...(slack?.team_id !== undefined ? { slackTeamId: slack.team_id } : {}),
  };
  try {
    await options.audit(complete);
  } catch (error) {
    console.error(
      '[mcp-audit] could not persist invocation; check MCP_AUDIT_PATH permissions and restart:',
      error instanceof Error ? error.message : 'unknown error',
    );
  }
}
