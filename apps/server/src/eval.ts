import 'dotenv/config';

import { AnthropicLlmClient } from '@precedent/llm-anthropic';
import { type Detector, EVAL_CASES, evaluate, HeuristicDetector, LlmDetector } from '@precedent/proposer';

function buildDetector(): Detector {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (apiKey !== undefined && apiKey !== '') {
    const model = process.env.ANTHROPIC_MODEL;
    console.log(`Detector: Claude (${model ?? 'claude-opus-4-8'})`);
    return new LlmDetector(new AnthropicLlmClient(model !== undefined ? { model } : {}));
  }
  console.log('Detector: heuristic');
  return new HeuristicDetector();
}

async function main(): Promise<void> {
  const metrics = await evaluate(buildDetector(), EVAL_CASES);
  const pct = (value: number): string => `${(value * 100).toFixed(1)}%`;
  console.log(`\nDetection eval — ${metrics.total} labeled cases`);
  console.log(`  precision ${pct(metrics.precision)} · recall ${pct(metrics.recall)} · F1 ${pct(metrics.f1)}`);
  console.log(`  TP ${metrics.tp} · FP ${metrics.fp} · FN ${metrics.fn} · TN ${metrics.tn}`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
