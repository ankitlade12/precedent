import { type DecisionContent, fixedClock, Ledger } from '@precedent/ledger-core';
import { recall } from '@precedent/proposer';
import { describe, expect, it } from 'vitest';

import { buildDecisionProposalCard, buildRecallAnswer, CONFIRM_ACTION } from '../src/blocks';

function content(overrides: Partial<DecisionContent>): DecisionContent {
  return {
    statement: '',
    type: 'technical',
    rationale: 'ops load not worth it',
    alternatives: [{ option: 'Memcached', reason: 'more to run' }],
    decidedBy: ['U_ALICE'],
    decidedAt: '2026-05-01T10:00:00.000Z',
    citations: [{ permalink: 'https://acme.slack.com/archives/C1/p1', channelId: 'C1', ts: '1.1' }],
    channelId: 'C1',
    ...overrides,
  };
}

describe('buildDecisionProposalCard', () => {
  it('renders a card with a Confirm action button', () => {
    const blocks = buildDecisionProposalCard({
      statement: 'Drop the Redis cache',
      rationale: 'ops load not worth it',
      alternatives: [{ option: 'Memcached', reason: 'more to run' }],
      decidedBy: ['U_ALICE'],
      citations: [{ permalink: 'https://acme.slack.com/archives/C1/p1', channelId: 'C1', ts: '1.1' }],
      channelId: 'C1',
      confidence: 0.55,
    }, 'tok-123');

    const actions = blocks.find((block) => block.type === 'actions');
    expect(actions).toBeDefined();
    expect(JSON.stringify(blocks)).toContain(CONFIRM_ACTION);
    expect(JSON.stringify(blocks)).toContain('Drop the Redis cache');
    expect(JSON.stringify(blocks)).toContain('tok-123');
  });
});

describe('buildRecallAnswer', () => {
  it('shows the current decision with a supersession warning and the source permalink', () => {
    const ledger = new Ledger({ clock: fixedClock('2026-06-01T00:00:00.000Z') });
    const first = ledger.append(content({ statement: 'Use Postgres' }), { confirmedBy: 'U1' });
    ledger.append(content({ statement: 'Use DynamoDB', supersedesId: first.id, supersessionType: 'reverse' }), {
      confirmedBy: 'U1',
    });

    const rendered = JSON.stringify(buildRecallAnswer('datastore', recall(ledger, 'postgres dynamodb datastore')));
    expect(rendered).toContain('Use DynamoDB');
    expect(rendered).toContain('overturned an earlier call');
    expect(rendered).toContain('acme.slack.com');
  });

  it('is honest when nothing is on record', () => {
    const ledger = new Ledger({ clock: fixedClock('2026-06-01T00:00:00.000Z') });
    const rendered = JSON.stringify(buildRecallAnswer('anything', recall(ledger, 'anything')));
    expect(rendered).toContain("don't have a recorded decision");
  });
});
