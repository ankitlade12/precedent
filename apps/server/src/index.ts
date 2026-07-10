import 'dotenv/config';

import { AnthropicLlmClient } from '@precedent/llm-anthropic';
import { Ledger } from '@precedent/ledger-core';
import { createMcpServer, startMcpHttp } from '@precedent/mcp-server';
import { type Detector, HeuristicDetector, LlmDetector } from '@precedent/proposer';
import { createSlackApp } from '@precedent/slack-app';
import { SqliteLedgerStore } from '@precedent/store-sqlite';

import { loadConfig } from './config';
import { createMcpAuditSink } from './audit';

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

  const integrity = ledger.verifyChain();
  if (!integrity.ok) {
    throw new Error(`Decision ledger integrity check failed at sequence ${integrity.brokenAt ?? 'unknown'}.`);
  }

  const detector = buildDetector();
  const slack = createSlackApp(config.slack, { ledger, detector });
  const audit = createMcpAuditSink(config.mcpAuditPath);

  let mcpHandle: Awaited<ReturnType<typeof startMcpHttp>> | undefined;
  try {
    await slack.start();
    mcpHandle = await startMcpHttp(
      ({ authSource }) => createMcpServer(ledger, { audit, authSource }),
      config.mcp,
    );
  } catch (error) {
    await slack.stop().catch(() => undefined);
    store.close();
    throw error;
  }

  console.log(
    `⚡ Precedent is running — Slack connected; MCP on :${mcpHandle.port}${config.mcp.path}; ${ledger.all().length} decisions on record`,
  );

  let stopping = false;
  const shutdown = async (): Promise<void> => {
    if (stopping) return;
    stopping = true;
    await Promise.allSettled([slack.stop(), mcpHandle.close()]);
    store.close();
  };
  process.once('SIGINT', () => void shutdown());
  process.once('SIGTERM', () => void shutdown());
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
