import { recall } from '@precedent/proposer';
import { describe, expect, it } from 'vitest';

import { seedLedger } from '../src/seed';

describe('seedLedger', () => {
  it('produces a verifiable ledger containing one reversed decision', () => {
    const ledger = seedLedger();
    expect(ledger.verifyChain().ok).toBe(true);

    const current = ledger.currentDecisions().map((record) => record.content.statement);
    expect(current).toContain('Use SQLite (libSQL) as the primary datastore');
    expect(current).not.toContain('Use Postgres as the primary datastore');
  });

  it('recall on the datastore topic returns the current call and flags the supersession', () => {
    const answer = recall(seedLedger(), 'primary datastore');
    expect(answer.decided).toBe(true);
    expect(answer.current?.content.statement).toContain('SQLite');
    expect(answer.wasSuperseded).toBe(true);
    expect(answer.history).toHaveLength(2);
  });
});
