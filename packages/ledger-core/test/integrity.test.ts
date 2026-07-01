import { describe, expect, it } from 'vitest';

import { canonicalize } from '../src/canonical';
import { fixedClock } from '../src/clock';
import { Ledger } from '../src/ledger';
import type { DecisionContent, DecisionRecord } from '../src/types';

function content(statement: string): DecisionContent {
  return {
    statement,
    type: 'technical',
    rationale: 'because',
    alternatives: [],
    decidedBy: ['U1'],
    decidedAt: '2026-05-01T10:00:00.000Z',
    citations: [],
    channelId: 'C1',
  };
}

function seededLedger(): Ledger {
  const ledger = new Ledger({ clock: fixedClock('2026-06-01T00:00:00.000Z') });
  ledger.append(content('one'), { confirmedBy: 'U1' });
  ledger.append(content('two'), { confirmedBy: 'U1' });
  ledger.append(content('three'), { confirmedBy: 'U1' });
  return ledger;
}

describe('canonicalize', () => {
  it('is independent of object key order', () => {
    expect(canonicalize({ a: 1, b: 2 })).toBe(canonicalize({ b: 2, a: 1 }));
  });

  it('preserves array order (arrays are semantically ordered)', () => {
    expect(canonicalize([1, 2])).not.toBe(canonicalize([2, 1]));
  });

  it('treats an omitted optional field and an explicit undefined identically', () => {
    expect(canonicalize({ a: 1 })).toBe(canonicalize({ a: 1, b: undefined }));
  });
});

describe('hash chain', () => {
  it('verifies a well-formed ledger', () => {
    expect(seededLedger().verifyChain()).toEqual({ ok: true });
  });

  it('detects tampering with a record’s content', () => {
    const ledger = seededLedger();
    // Reach past the append-only API to simulate an attacker editing storage.
    const tampered = ledger.all()[1] as DecisionRecord;
    tampered.content.statement = 'quietly rewritten';

    expect(ledger.verifyChain()).toEqual({ ok: false, brokenAt: 1 });
  });

  it('chains each record to its predecessor', () => {
    const [first, second, third] = seededLedger().all();
    expect(first?.prevHash).toBe('');
    expect(second?.prevHash).toBe(first?.recordHash);
    expect(third?.prevHash).toBe(second?.recordHash);
  });
});
