import 'dotenv/config';

import { AnthropicLlmClient } from '@precedent/llm-anthropic';
import { Ledger } from '@precedent/ledger-core';
import { createMcpServer, startMcpHttp } from '@precedent/mcp-server';
import { type Detector, HeuristicDetector, LlmDetector } from '@precedent/proposer';
import { createSlackApp } from '@precedent/slack-app';
import { SqliteLedgerStore } from '@precedent/store-sqlite';

import { loadConfig } from './config';
import { seedInto } from './seed';

/** Use Claude for decision extraction when configured; otherwise the precision-first heuristic. */
function buildDetector(): Detector {
  if (process.env.PRECEDENT_DETECTOR === 'heuristic') {
    console.log('Detector: heuristic (forced by PRECEDENT_DETECTOR)');
    return new HeuristicDetector();
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (apiKey !== undefined && apiKey !== '') {
    const model = process.env.ANTHROPIC_MODEL;
    console.log(`Detector: Claude (${model ?? 'claude-opus-4-8'})`);
    return new LlmDetector(new AnthropicLlmClient(model !== undefined ? { model } : {}));
  }
  console.log('Detector: heuristic (set ANTHROPIC_API_KEY in .env for Claude extraction)');
  return new HeuristicDetector();
}

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

  const detector = buildDetector();
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
