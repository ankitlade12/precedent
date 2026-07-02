import { describe, expect, it } from 'vitest';

import { HeuristicDetector } from '../src/detector';
import { EVAL_CASES, evaluate } from '../src/eval';
import type { Detector } from '../src/detector';
import type { DecisionProposal } from '../src/types';

const PROPOSAL: DecisionProposal = {
  statement: 'x',
  rationale: '',
  alternatives: [],
  decidedBy: [],
  citations: [],
  channelId: 'C',
  confidence: 1,
};

/** A stub detector that "fires" when the message contains a marker. */
function flagOn(marker: string): Detector {
  return {
    detect: (context) => Promise.resolve((context.messages[0]?.text ?? '').includes(marker) ? PROPOSAL : null),
  };
}

describe('evaluate', () => {
  it('computes precision/recall/F1 from the confusion matrix', async () => {
    const cases = [
      { name: 'tp', isDecision: true, context: { channelId: 'C', messages: [{ userId: 'U', text: 'DEC a', ts: '1', channelId: 'C', permalink: 'p' }] } },
      { name: 'fn', isDecision: true, context: { channelId: 'C', messages: [{ userId: 'U', text: 'quiet', ts: '2', channelId: 'C', permalink: 'p' }] } },
      { name: 'fp', isDecision: false, context: { channelId: 'C', messages: [{ userId: 'U', text: 'DEC c', ts: '3', channelId: 'C', permalink: 'p' }] } },
      { name: 'tn', isDecision: false, context: { channelId: 'C', messages: [{ userId: 'U', text: 'plain', ts: '4', channelId: 'C', permalink: 'p' }] } },
    ];
    const metrics = await evaluate(flagOn('DEC'), cases);
    expect(metrics).toMatchObject({ tp: 1, fn: 1, fp: 1, tn: 1, precision: 0.5, recall: 0.5, f1: 0.5 });
  });

  it('the heuristic detector is precision-first on the labeled set', async () => {
    const metrics = await evaluate(new HeuristicDetector(), EVAL_CASES);
    expect(metrics.precision).toBe(1); // never proposes on a non-decision
    expect(metrics.fp).toBe(0);
    expect(metrics.recall).toBeGreaterThanOrEqual(0.6); // misses cue-less decisions, as expected
  });
});
