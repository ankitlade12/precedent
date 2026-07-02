import 'dotenv/config';

import { Ledger } from '@precedent/ledger-core';
import { createMcpServer, startMcpHttp } from '@precedent/mcp-server';
import { HeuristicDetector } from '@precedent/proposer';
import { createSlackApp } from '@precedent/slack-app';
import { SqliteLedgerStore } from '@precedent/store-sqlite';

import { loadConfig } from './config';
import { seedInto } from './seed';

/**
 * The composition root: the only place the pieces are wired together. The
 * deterministic ledger is the source of truth; the Slack app and the MCP server
 * are two surfaces over it, and they run in a single process on a single host.
 */
async function main(): Promise<void> {
  const config = loadConfig();

  const store = new SqliteLedgerStore(config.databasePath);
  const ledger = new Ledger({ store });
  if (store.size() === 0) {
    seedInto(ledger);
    console.log(`Seeded ${ledger.all().length} demo decisions into ${config.databasePath}`);
  }

  const detector = new HeuristicDetector();
  const slack = createSlackApp(config.slack, { ledger, detector });

  await slack.start();
  const mcpHandle = await startMcpHttp(() => createMcpServer(ledger), config.mcp);

  console.log(
    `⚡ Precedent is running — Slack connected; MCP on :${mcpHandle.port}${config.mcp.path}; ${ledger.all().length} decisions on record`,
  );
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
