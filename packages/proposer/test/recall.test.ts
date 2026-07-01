import { fixedClock, type DecisionContent, Ledger } from '@precedent/ledger-core';
import { describe, expect, it } from 'vitest';

import { recall } from '../src/recall';

function content(overrides: Partial<DecisionContent>): DecisionContent {
  return {
    statement: '',
    type: 'technical',
    rationale: '',
    alternatives: [],
    decidedBy: ['U1'],
    decidedAt: '2026-05-01T10:00:00.000Z',
    citations: [],
    channelId: 'C1',
    ...overrides,
  };
}

describe('recall', () => {
  it('returns the current decision and flags that it superseded an earlier one', () => {
    const ledger = new Ledger({ clock: fixedClock('2026-06-01T00:00:00.000Z') });
    const first = ledger.append(content({ statement: 'Use Postgres for the primary store' }), { confirmedBy: 'U1' });
    const second = ledger.append(
      content({ statement: 'Use DynamoDB for the primary store', supersedesId: first.id, supersessionType: 'reverse' }),
      { confirmedBy: 'U1' },
    );

    const answer = recall(ledger, 'primary store database');
    expect(answer.decided).toBe(true);
    expect(answer.current?.id).toBe(second.id);
    expect(answer.wasSuperseded).toBe(true);
    expect(answer.history.map((record) => record.id)).toEqual([first.id, second.id]);
  });

  it('reports when nothing has been decided on a topic', () => {
    const ledger = new Ledger({ clock: fixedClock('2026-06-01T00:00:00.000Z') });
    expect(recall(ledger, 'which kubernetes ingress').decided).toBe(false);
  });
});
