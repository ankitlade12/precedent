import type { Detector } from './detector';
import type { ThreadContext } from './types';

/** A hand-labeled thread: whether it actually contains a decision. */
export interface LabeledCase {
  name: string;
  context: ThreadContext;
  isDecision: boolean;
}

export interface EvalMetrics {
  total: number;
  tp: number;
  fp: number;
  fn: number;
  tn: number;
  precision: number;
  recall: number;
  f1: number;
}

/**
 * Run a detector over a labeled set and compute precision/recall/F1. This is how
 * detection-quality claims are backed by a number rather than vibes — the hard
 * part of the product, measured honestly.
 */
export async function evaluate(detector: Detector, cases: readonly LabeledCase[]): Promise<EvalMetrics> {
  let tp = 0;
  let fp = 0;
  let fn = 0;
  let tn = 0;

  for (const testCase of cases) {
    const detected = (await detector.detect(testCase.context)) !== null;
    if (detected && testCase.isDecision) {
      tp += 1;
    } else if (detected && !testCase.isDecision) {
      fp += 1;
    } else if (!detected && testCase.isDecision) {
      fn += 1;
    } else {
      tn += 1;
    }
  }

  const precision = tp + fp === 0 ? 1 : tp / (tp + fp);
  const recall = tp + fn === 0 ? 1 : tp / (tp + fn);
  const f1 = precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall);
  return { total: cases.length, tp, fp, fn, tn, precision, recall, f1 };
}

function make(name: string, text: string, isDecision: boolean): LabeledCase {
  return {
    name,
    isDecision,
    context: {
      channelId: 'C_EVAL',
      messages: [{ userId: 'U_EVAL', text, ts: '1.1', channelId: 'C_EVAL', permalink: 'https://acme.slack.com/p1' }],
    },
  };
}

/**
 * A small hand-labeled set for measuring detection precision/recall. It
 * deliberately includes decisions with *no* explicit cue (which the heuristic
 * misses, capping recall) so the reported number is honest.
 */
export const EVAL_CASES: readonly LabeledCase[] = [
  make('going-with', "we're going with Postgres over MySQL because it's more robust", true),
  make('lets-go-with', "let's go with GitHub Actions for CI", true),
  make('we-decided', 'we decided to drop the Redis cache', true),
  make('well-use', "we'll use Vitest for testing", true),
  make('decision-prefix', 'decision: adopt the MIT License for the project', true),
  make('implicit-affirm', 'Alright, Postgres it is then.', true),
  make('implicit-agree', 'Agreed, we ship on Friday.', true),
  make('question-db', 'what database should we use?', false),
  make('suggestion', 'I think maybe we could use Redis here', false),
  make('chit-chat', "how is everyone doing today?", false),
  make('question-reopen', 'should we reconsider the auth provider?', false),
  make('status', 'the deploy finished successfully', false),
];
