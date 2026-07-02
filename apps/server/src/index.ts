import 'dotenv/config';

import { createMcpServer, startMcpHttp } from '@precedent/mcp-server';
import { HeuristicDetector } from '@precedent/proposer';
import { createSlackApp } from '@precedent/slack-app';

import { loadConfig } from './config';
import { seedLedger } from './seed';

/**
 * The composition root: the only place the pieces are wired together. The
 * deterministic ledger is the source of truth; the Slack app and the MCP server
 * are two surfaces over it, and they run in a single process on a single host.
 */
async function main(): Promise<void> {
  const config = loadConfig();

  // TODO: swap the in-memory seed for a persistent store — see docs/architecture/storage.md.
  const ledger = seedLedger();
  const detector = new HeuristicDetector();

  const slack = createSlackApp(config.slack, { ledger, detector });

  await slack.start();
  const mcpHandle = await startMcpHttp(() => createMcpServer(ledger), config.mcp);

  console.log(`⚡ Precedent is running — Slack app connected; MCP on :${mcpHandle.port}${config.mcp.path}`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
