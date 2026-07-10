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

  it('does not fabricate a confident match from a single incidental shared word', () => {
    const ledger = new Ledger({ clock: fixedClock('2026-06-01T00:00:00.000Z') });
    ledger.append(content({ statement: 'Use Postgres', rationale: 'the core team already knows it well' }), {
      confirmedBy: 'U1',
    });
    expect(recall(ledger, 'what is our vacation policy for the whole team').decided).toBe(false);
  });

  it('lets the relitigation guard match on a single distinctive term (minOverlap 1)', () => {
    const ledger = new Ledger({ clock: fixedClock('2026-06-01T00:00:00.000Z') });
    const decision = ledger.append(content({ statement: 'Standardize on pnpm over npm for package management' }), {
      confirmedBy: 'U1',
    });

    // A natural relitigation question names the topic with one distinctive word.
    // The strict recall path (2 terms) stays silent; the guard's looser path fires.
    expect(recall(ledger, 'should we go back to npm?').decided).toBe(false);
    const guard = recall(ledger, 'should we go back to npm?', { minOverlap: 1 });
    expect(guard.decided).toBe(true);
    expect(guard.current?.id).toBe(decision.id);
  });

  it('restricts recall to explicitly visible Slack channels', () => {
    const ledger = new Ledger({ clock: fixedClock('2026-06-01T00:00:00.000Z') });
    ledger.append(content({ statement: 'Use Clerk as the auth provider', channelId: 'C_PRIVATE' }), { confirmedBy: 'U1' });

    expect(recall(ledger, 'auth provider', { channelIds: ['C_PUBLIC'] }).decided).toBe(false);
    expect(recall(ledger, 'auth provider', { channelIds: ['C_PRIVATE'] }).decided).toBe(true);
  });

  it('matches rejected alternatives so old option names resolve to the current call', () => {
    const ledger = new Ledger({ clock: fixedClock('2026-06-01T00:00:00.000Z') });
    ledger.append(
      content({
        statement: 'Standardize package management on pnpm',
        alternatives: [{ option: 'npm', reason: 'slower workspace installs' }],
      }),
      { confirmedBy: 'U1' },
    );
    expect(recall(ledger, 'npm', { minOverlap: 1 }).current?.content.statement).toContain('pnpm');
  });
});
