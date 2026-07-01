import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { Ledger } from '@precedent/ledger-core';
import { z } from 'zod';

import { getDecision, hasThisBeenDecided, listDecisions } from './tools';

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
export function createMcpServer(ledger: Ledger): McpServer {
  const server = new McpServer({ name: 'precedent', version: '0.1.0' });

  server.registerTool(
    'has_this_been_decided',
    {
      description:
        'Check whether the team has already decided a question. Returns the CURRENT decision (supersession resolved), its history, and the source message permalinks.',
      inputSchema: {
        topic: z.string().describe('The question or topic to check, e.g. "auth provider" or "primary datastore".'),
      },
    },
    ({ topic }) => ({
      content: [{ type: 'text' as const, text: JSON.stringify(hasThisBeenDecided(ledger, topic), null, 2) }],
    }),
  );

  server.registerTool(
    'get_decision',
    {
      description: 'Fetch a single decision record by id (e.g. DR-a1b2c3d4e5f6).',
      inputSchema: { id: z.string().describe('A decision id.') },
    },
    ({ id }) => {
      const decision = getDecision(ledger, id);
      return {
        content: [{ type: 'text' as const, text: decision ? JSON.stringify(decision, null, 2) : `No decision ${id}.` }],
      };
    },
  );

  server.registerTool(
    'list_decisions',
    {
      description: 'List all current (non-superseded) decisions in the ledger.',
      inputSchema: {},
    },
    () => ({
      content: [{ type: 'text' as const, text: JSON.stringify(listDecisions(ledger), null, 2) }],
    }),
  );

  return server;
}
