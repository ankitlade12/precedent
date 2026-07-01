import { describe, expect, it } from 'vitest';

import { HeuristicDetector } from '../src/detector';
import type { ThreadContext } from '../src/types';

function ctx(decisionText: string): ThreadContext {
  return {
    channelId: 'C_ENG',
    threadTs: '1746000000.000100',
    messages: [
      { userId: 'U_BOB', text: 'What cache should we use?', ts: '1', channelId: 'C_ENG', permalink: 'https://acme.slack.com/archives/C_ENG/p1' },
      { userId: 'U_ALICE', text: decisionText, ts: '2', channelId: 'C_ENG', permalink: 'https://acme.slack.com/archives/C_ENG/p2' },
    ],
  };
}

describe('HeuristicDetector', () => {
  const detector = new HeuristicDetector();

  it('proposes a decision, with rationale and rejected alternative, on a commitment cue', async () => {
    const proposal = await detector.detect(
      ctx("we're dropping Redis over Memcached because the ops load isn't worth it"),
    );

    expect(proposal).not.toBeNull();
    expect(proposal?.statement.toLowerCase()).toContain('dropping redis');
    expect(proposal?.decidedBy).toEqual(['U_ALICE']);
    expect(proposal?.citations[0]?.permalink).toBe('https://acme.slack.com/archives/C_ENG/p2');
    expect(proposal?.rationale.toLowerCase()).toContain('ops load');
    expect(proposal?.alternatives[0]?.option.toLowerCase()).toContain('memcached');
    expect(proposal?.confidence).toBeGreaterThan(0);
  });

  it('returns null when the thread is only discussion', async () => {
    const proposal = await detector.detect(ctx('I think maybe Redis could work but I am not sure yet'));
    expect(proposal).toBeNull();
  });
});
