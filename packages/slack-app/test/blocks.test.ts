import { type DecisionContent, fixedClock, Ledger } from '@precedent/ledger-core';
import { recall } from '@precedent/proposer';
import { describe, expect, it } from 'vitest';

import {
  buildDecisionProposalCard,
  buildEditDecisionModal,
  buildOnboardingBrief,
  buildRecallAnswer,
  buildRelitigationNudge,
  CONFIRM_ACTION,
  EDIT_MODAL_CALLBACK,
} from '../src/blocks';

function content(overrides: Partial<DecisionContent>): DecisionContent {
  return {
    statement: '',
    type: 'technical',
    rationale: 'ops load not worth it',
    alternatives: [{ option: 'Memcached', reason: 'more to run' }],
    decidedBy: ['UALICE'],
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

  it('escapes model-produced Slack control syntax', () => {
    const rendered = JSON.stringify(buildDecisionProposalCard({
      statement: 'Notify <!channel> about <https://malicious.example|this>',
      rationale: 'A & B',
      alternatives: [],
      decidedBy: ['U_ALICE'],
      citations: [{ permalink: 'https://acme.slack.com/archives/C1/p1', channelId: 'C1', ts: '1.1' }],
      channelId: 'C1',
      confidence: 0.55,
    }));
    expect(rendered).not.toContain('<!channel>');
    expect(rendered).toContain('&lt;!channel&gt;');
    expect(rendered).toContain('A &amp; B');
  });

  it('makes a reversal visually prominent with an old-to-new lifecycle', () => {
    const ledger = new Ledger({ clock: fixedClock('2026-06-01T00:00:00.000Z') });
    const earlier = ledger.append(content({ statement: 'Use Postgres for storage' }), { confirmedBy: 'U1' });
    const rendered = JSON.stringify(buildDecisionProposalCard({
      statement: 'Use SQLite for storage',
      rationale: 'simpler operations',
      alternatives: [{ option: 'Postgres', reason: 'too much infrastructure' }],
      decidedBy: ['UALICE'],
      citations: [{ permalink: 'https://acme.slack.com/archives/C1/p2', channelId: 'C1', ts: '2.2' }],
      channelId: 'C1',
      supersedesId: earlier.id,
      supersessionType: 'reverse',
      confidence: 0.9,
    }, 'tok-reverse', { supersededDecision: earlier }));
    expect(rendered).toContain('REVERSAL proposed');
    expect(rendered).toContain('This reverses decision');
    expect(rendered).toContain('Use Postgres for storage');
    expect(rendered).toContain('Use SQLite for storage');
  });
});

describe('buildEditDecisionModal', () => {
  it('prefills the proposal and carries message metadata', () => {
    const view = buildEditDecisionModal({
      statement: 'Drop the Redis cache',
      rationale: 'ops load not worth it',
      alternatives: [{ option: 'Memcached', reason: 'more to run' }],
      decidedBy: ['U_ALICE'],
      citations: [{ permalink: 'https://acme.slack.com/archives/C1/p1', channelId: 'C1', ts: '1.1' }],
      channelId: 'C1',
      confidence: 0.55,
    }, { token: 'tok-123', channelId: 'C1', messageTs: '123.456' });

    const rendered = JSON.stringify(view);
    expect(view.callback_id).toBe(EDIT_MODAL_CALLBACK);
    expect(rendered).toContain('Drop the Redis cache');
    expect(rendered).toContain('ops load not worth it');
    expect(rendered).toContain('Memcached - more to run');
    expect(rendered).toContain('tok-123');
    expect(rendered).toContain('123.456');
    expect(rendered).toContain('Does this change an earlier decision?');
    expect(rendered).toContain('static_select');
    expect(rendered).toContain('Change relationship');
  });

  it('offers existing decisions as selectable lifecycle targets', () => {
    const ledger = new Ledger({ clock: fixedClock('2026-06-01T00:00:00.000Z') });
    const existing = ledger.append(content({ statement: 'Use Postgres for storage' }), { confirmedBy: 'U1' });
    const view = buildEditDecisionModal({
      statement: 'Use SQLite for storage',
      rationale: 'simpler operations',
      alternatives: [],
      decidedBy: ['UALICE'],
      citations: [{ permalink: 'https://acme.slack.com/archives/C1/p2', channelId: 'C1', ts: '2.2' }],
      channelId: 'C1',
      supersedesId: existing.id,
      supersessionType: 'reverse',
      confidence: 0.9,
    }, { token: 'tok-select', channelId: 'C1', messageTs: '2.2' }, [existing]);
    const rendered = JSON.stringify(view);
    expect(rendered).toContain('Use Postgres for storage');
    expect(rendered).toContain(existing.id);
    expect(rendered).toContain('Reverses the earlier decision');
  });
});

describe('buildRecallAnswer', () => {
  it('shows the current decision with a supersession warning and the source permalink', () => {
    const ledger = new Ledger({ clock: fixedClock('2026-06-01T00:00:00.000Z') });
    const first = ledger.append(content({ statement: 'Use Postgres for the primary datastore' }), { confirmedBy: 'U1' });
    ledger.append(
      content({ statement: 'Use DynamoDB for the primary datastore', supersedesId: first.id, supersessionType: 'reverse' }),
      { confirmedBy: 'U1' },
    );

    const rendered = JSON.stringify(buildRecallAnswer('primary datastore', recall(ledger, 'primary datastore')));
    expect(rendered).toContain('Current precedent');
    expect(rendered).toContain('Current decision');
    expect(rendered).toContain('Use DynamoDB');
    expect(rendered).toContain('overturned an earlier call');
    expect(rendered).toContain('Decision timeline');
    expect(rendered).toContain('May 1, 2026');
    expect(rendered).toContain('{date_short_pretty} at {time}');
    expect(rendered).toContain('<@UALICE>');
    expect(rendered).toContain(first.id);
    expect(rendered).toContain('acme.slack.com');
  });

  it('is honest when nothing is on record', () => {
    const ledger = new Ledger({ clock: fixedClock('2026-06-01T00:00:00.000Z') });
    const rendered = JSON.stringify(buildRecallAnswer('anything', recall(ledger, 'anything')));
    expect(rendered).toContain("don't have a recorded decision");
  });
});

describe('buildRelitigationNudge', () => {
  it('surfaces the current decision when a settled question resurfaces', () => {
    const ledger = new Ledger({ clock: fixedClock('2026-06-01T00:00:00.000Z') });
    ledger.append(content({ statement: 'Drop the Redis cache' }), { confirmedBy: 'U1' });
    const rendered = JSON.stringify(buildRelitigationNudge(recall(ledger, 'redis cache')));
    expect(rendered).toContain('looks settled');
    expect(rendered).toContain('Drop the Redis cache');
  });

  it('renders nothing when the topic is undecided', () => {
    const ledger = new Ledger({ clock: fixedClock('2026-06-01T00:00:00.000Z') });
    expect(buildRelitigationNudge(recall(ledger, 'anything'))).toHaveLength(0);
  });
});

describe('buildOnboardingBrief', () => {
  it('teaches an empty workspace how to create its first decision', () => {
    const rendered = JSON.stringify(buildOnboardingBrief([]));
    expect(rendered).toContain('Build your team’s decision memory');
    expect(rendered).toContain('1 · Make a decision');
    expect(rendered).toContain('2 · Review the proposal card');
    expect(rendered).toContain('3 · Recall it anywhere');
  });

  it('lists the current decisions for a newcomer', () => {
    const ledger = new Ledger({ clock: fixedClock('2026-06-01T00:00:00.000Z') });
    ledger.append(content({ statement: 'Drop the Redis cache' }), { confirmedBy: 'U1' });
    const rendered = JSON.stringify(buildOnboardingBrief([...ledger.currentDecisions()]));
    expect(rendered).toContain('Community decision memory');
    expect(rendered).toContain('new contributor');
    expect(rendered).toContain('maintainer turnover');
    expect(rendered).toContain('Drop the Redis cache');
  });
});
