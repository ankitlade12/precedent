import { type DecisionContent, fixedClock, Ledger } from '@precedent/ledger-core';
import { describe, expect, it } from 'vitest';

import { getDecision, hasThisBeenDecided, listDecisions } from '../src/tools';

function content(overrides: Partial<DecisionContent>): DecisionContent {
  return {
    statement: '',
    type: 'technical',
    rationale: '',
    alternatives: [],
    decidedBy: ['U1'],
    decidedAt: '2026-05-01T10:00:00.000Z',
    citations: [{ permalink: 'https://acme.slack.com/archives/C1/p1', channelId: 'C1', ts: '1.1' }],
    channelId: 'C1',
    ...overrides,
  };
}

function seeded(): Ledger {
  const ledger = new Ledger({ clock: fixedClock('2026-06-01T00:00:00.000Z') });
  const first = ledger.append(content({ statement: 'Auth provider is Auth0' }), { confirmedBy: 'U1' });
  ledger.append(
    content({ statement: 'Auth provider is Clerk', supersedesId: first.id, supersessionType: 'reverse' }),
    { confirmedBy: 'U1' },
  );
  return ledger;
}

describe('has_this_been_decided', () => {
  it('returns the current decision with supersession resolved and grounded citations', () => {
    const result = hasThisBeenDecided(seeded(), 'auth provider');
    expect(result.decided).toBe(true);
    expect(result.current?.statement).toBe('Auth provider is Clerk');
    expect(result.current?.status).toBe('confirmed');
    expect(result.wasSuperseded).toBe(true);
    expect(result.history.map((d) => d.statement)).toEqual(['Auth provider is Auth0', 'Auth provider is Clerk']);
    expect(result.current?.citations[0]?.permalink).toContain('slack.com');
  });

  it('reports an undecided topic honestly', () => {
    expect(hasThisBeenDecided(seeded(), 'deployment platform').decided).toBe(false);
  });
});

describe('get_decision / list_decisions', () => {
  it('lists only current (non-superseded) decisions', () => {
    const ledger = seeded();
    const current = listDecisions(ledger);
    expect(current).toHaveLength(1);
    expect(current[0]?.statement).toBe('Auth provider is Clerk');
  });

  it('fetches a record by id', () => {
    const ledger = seeded();
    const id = ledger.all()[0]!.id;
    expect(getDecision(ledger, id)?.id).toBe(id);
    expect(getDecision(ledger, 'DR-missing')).toBeUndefined();
  });
});
