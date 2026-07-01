import { describe, expect, it } from 'vitest';

import { fixedClock } from '../src/clock';
import { decisionId } from '../src/hash';
import { Ledger } from '../src/ledger';
import type { DecisionContent } from '../src/types';

const CLOCK = fixedClock('2026-06-01T00:00:00.000Z');

function content(overrides: Partial<DecisionContent> = {}): DecisionContent {
  return {
    statement: 'Drop the Redis cache',
    type: 'technical',
    rationale: 'The operational load is not worth it for our traffic.',
    alternatives: [{ option: 'Keep Redis', reason: 'Adds ops burden nobody owns' }],
    decidedBy: ['U_ALICE'],
    decidedAt: '2026-05-01T10:00:00.000Z',
    citations: [
      { permalink: 'https://acme.slack.com/archives/C_ENG/p1746093600', channelId: 'C_ENG', ts: '1746093600.000100' },
    ],
    channelId: 'C_ENG',
    ...overrides,
  };
}

function newLedger(): Ledger {
  return new Ledger({ clock: CLOCK });
}

describe('append', () => {
  it('writes a confirmed record with genesis chain metadata', () => {
    const ledger = newLedger();
    const record = ledger.append(content(), { confirmedBy: 'U_MAINTAINER' });

    expect(record.id).toMatch(/^DR-[0-9a-f]{12}$/);
    expect(record.sequence).toBe(0);
    expect(record.status).toBe('confirmed');
    expect(record.prevHash).toBe('');
    expect(record.confirmedBy).toBe('U_MAINTAINER');
    expect(record.confirmedAt).toBe('2026-06-01T00:00:00.000Z');
  });

  it('is content-addressed and idempotent (dedup)', () => {
    const ledger = newLedger();
    const first = ledger.append(content(), { confirmedBy: 'U1' });
    const second = ledger.append(content(), { confirmedBy: 'U2' });

    expect(second.id).toBe(first.id);
    expect(ledger.all()).toHaveLength(1);
    // The first confirmer wins; the duplicate append is a no-op.
    expect(second.confirmedBy).toBe('U1');
  });

  it('derives the same id for identical content across ledgers', () => {
    expect(decisionId(content())).toBe(decisionId(content()));
    expect(decisionId(content())).not.toBe(decisionId(content({ statement: 'Keep Redis' })));
  });

  it('rejects superseding a decision that is not in the ledger', () => {
    const ledger = newLedger();
    expect(() =>
      ledger.append(content({ supersedesId: 'DR-000000000000' }), { confirmedBy: 'U1' }),
    ).toThrow(/unknown decision/);
  });
});

describe('supersession resolution', () => {
  it('resolves recall to the current head and marks the old call superseded', () => {
    const ledger = newLedger();
    const original = ledger.append(content({ statement: 'Use Postgres' }), { confirmedBy: 'U1' });
    const replacement = ledger.append(
      content({ statement: 'Use DynamoDB', supersedesId: original.id, supersessionType: 'reverse' }),
      { confirmedBy: 'U1' },
    );

    expect(ledger.resolveHead(original.id)?.id).toBe(replacement.id);
    expect(ledger.isSuperseded(original.id)).toBe(true);
    expect(ledger.effectiveStatus(original.id)).toBe('reversed');
    expect(ledger.currentDecisions().map((r) => r.id)).toEqual([replacement.id]);
    expect(ledger.history(original.id).map((r) => r.id)).toEqual([original.id, replacement.id]);
  });

  it('walks a multi-step chain to the newest decision', () => {
    const ledger = newLedger();
    const a = ledger.append(content({ statement: 'v1: monolith' }), { confirmedBy: 'U1' });
    const b = ledger.append(content({ statement: 'v2: services', supersedesId: a.id }), { confirmedBy: 'U1' });
    const c = ledger.append(content({ statement: 'v3: modular monolith', supersedesId: b.id }), { confirmedBy: 'U1' });

    expect(ledger.resolveHead(a.id)?.id).toBe(c.id);
    expect(ledger.currentDecisions().map((r) => r.id)).toEqual([c.id]);
    expect(ledger.history(b.id).map((r) => r.id)).toEqual([a.id, b.id, c.id]);
    // A plain supersession (no explicit type) reads as 'superseded', not 'reversed'.
    expect(ledger.effectiveStatus(a.id)).toBe('superseded');
  });

  it('returns undefined effective status and head for unknown ids', () => {
    const ledger = newLedger();
    expect(ledger.effectiveStatus('DR-nope')).toBeUndefined();
    expect(ledger.resolveHead('DR-nope')).toBeUndefined();
    expect(ledger.history('DR-nope')).toEqual([]);
  });
});
