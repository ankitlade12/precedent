import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { fixedClock, Ledger, type DecisionContent } from '@precedent/ledger-core';
import { afterAll, describe, expect, it } from 'vitest';

import { SqliteLedgerStore } from '../src/sqlite-store';

const dir = mkdtempSync(join(tmpdir(), 'precedent-sqlite-'));

afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

function content(statement: string, overrides: Partial<DecisionContent> = {}): DecisionContent {
  return {
    statement,
    type: 'technical',
    rationale: 'because',
    alternatives: [],
    decidedBy: ['U1'],
    decidedAt: '2026-05-01T10:00:00.000Z',
    citations: [{ permalink: 'https://x.slack.com/archives/C1/p1', channelId: 'C1', ts: '1.1' }],
    channelId: 'C1',
    ...overrides,
  };
}

describe('SqliteLedgerStore', () => {
  it('persists decisions across store instances (survives a restart)', () => {
    const path = join(dir, 'restart.db');
    const clock = fixedClock('2026-06-01T00:00:00.000Z');

    const first = new SqliteLedgerStore(path);
    const ledger = new Ledger({ store: first, clock });
    const a = ledger.append(content('Use Postgres'), { confirmedBy: 'U1' });
    ledger.append(content('Use SQLite', { supersedesId: a.id, supersessionType: 'reverse' }), { confirmedBy: 'U1' });
    first.close();

    // Reopen the same file in a fresh store — the records and the hash chain survive.
    const reopened = new SqliteLedgerStore(path);
    const reloaded = new Ledger({ store: reopened });
    expect(reopened.size()).toBe(2);
    expect(reloaded.verifyChain()).toEqual({ ok: true });
    expect(reloaded.currentDecisions().map((r) => r.content.statement)).toEqual(['Use SQLite']);
    expect(reloaded.resolveHead(a.id)?.content.statement).toBe('Use SQLite');
    reopened.close();
  });

  it('is append-only and dedups by content-addressed id', () => {
    const store = new SqliteLedgerStore(':memory:');
    const ledger = new Ledger({ store, clock: fixedClock('2026-06-01T00:00:00.000Z') });
    const first = ledger.append(content('Adopt Vitest'), { confirmedBy: 'U1' });
    const again = ledger.append(content('Adopt Vitest'), { confirmedBy: 'U2' });

    expect(again.id).toBe(first.id);
    expect(store.size()).toBe(1);
    store.close();
  });
});
