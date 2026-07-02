import { type Clock, type DecisionContent, fixedClock, Ledger } from '@precedent/ledger-core';

interface SeedInput {
  statement: string;
  type: DecisionContent['type'];
  rationale: string;
  alternatives?: { option: string; reason: string }[];
  decidedBy: string[];
  decidedAt: string;
  channelId: string;
  ts: string;
  scope?: string;
  supersedesId?: string;
  supersessionType?: DecisionContent['supersessionType'];
}

function content(input: SeedInput): DecisionContent {
  return {
    statement: input.statement,
    type: input.type,
    rationale: input.rationale,
    alternatives: input.alternatives ?? [],
    decidedBy: input.decidedBy,
    decidedAt: input.decidedAt,
    citations: [
      {
        permalink: `https://opensource-demo.slack.com/archives/${input.channelId}/p${input.ts.replace('.', '')}`,
        channelId: input.channelId,
        ts: input.ts,
      },
    ],
    channelId: input.channelId,
    ...(input.scope !== undefined ? { scope: input.scope } : {}),
    ...(input.supersedesId !== undefined ? { supersedesId: input.supersedesId } : {}),
    ...(input.supersessionType !== undefined ? { supersessionType: input.supersessionType } : {}),
  };
}

/**
 * A believable open-source-community workspace history for the demo, including a
 * decision that gets reversed six weeks later — so the supersession moment (the
 * thing search can never do) has something true to stand on.
 */
export function seedInto(ledger: Ledger): void {
  ledger.append(
    content({
      statement: 'Drop the Redis cache layer',
      type: 'technical',
      rationale: 'The operational load outweighs the latency win at our scale.',
      alternatives: [
        { option: 'Keep Redis', reason: 'No maintainer wants to own the ops burden.' },
        { option: 'Memcached', reason: 'Same ops cost, fewer features.' },
      ],
      decidedBy: ['U_MAINTAINER'],
      decidedAt: '2026-05-02T14:20:00.000Z',
      channelId: 'C_ENG',
      ts: '1746195600.000200',
      scope: 'api',
    }),
    { confirmedBy: 'U_MAINTAINER', confidence: 0.82 },
  );

  ledger.append(
    content({
      statement: 'Adopt Conventional Commits across all repositories',
      type: 'process',
      rationale: 'Enables automated changelogs and lowers the barrier for new contributors.',
      decidedBy: ['U_MAINTAINER', 'U_CORE'],
      decidedAt: '2026-05-05T09:10:00.000Z',
      channelId: 'C_GOV',
      ts: '1746435000.000100',
      scope: 'org',
    }),
    { confirmedBy: 'U_MAINTAINER', confidence: 0.77 },
  );

  const postgres = ledger.append(
    content({
      statement: 'Use Postgres as the primary datastore',
      type: 'technical',
      rationale: 'Relational integrity, and the core team already knows it well.',
      alternatives: [{ option: 'DynamoDB', reason: 'Overkill for our write volume.' }],
      decidedBy: ['U_CORE'],
      decidedAt: '2026-05-08T16:00:00.000Z',
      channelId: 'C_ENG',
      ts: '1746720000.000300',
      scope: 'storage',
    }),
    { confirmedBy: 'U_CORE', confidence: 0.8 },
  );

  // Six weeks later, reversed. This is the demo's knockout moment.
  ledger.append(
    content({
      statement: 'Use SQLite (libSQL) as the primary datastore',
      type: 'technical',
      rationale: 'Append-only, single-writer workload; SQLite is simpler to run and cheaper for a small community to self-host.',
      alternatives: [{ option: 'Postgres', reason: 'More infrastructure than a volunteer project needs to operate.' }],
      decidedBy: ['U_MAINTAINER', 'U_CORE'],
      decidedAt: '2026-06-14T11:30:00.000Z',
      channelId: 'C_ENG',
      ts: '1749900600.000400',
      scope: 'storage',
      supersedesId: postgres.id,
      supersessionType: 'reverse',
    }),
    { confirmedBy: 'U_MAINTAINER', confidence: 0.86 },
  );

  ledger.append(
    content({
      statement: 'License the project under Apache-2.0',
      type: 'governance',
      rationale: 'The explicit patent grant matters for downstream adopters and a future sustainable tier.',
      alternatives: [{ option: 'MIT', reason: 'Simpler, but without an explicit patent grant.' }],
      decidedBy: ['U_MAINTAINER'],
      decidedAt: '2026-05-01T10:00:00.000Z',
      channelId: 'C_GOV',
      ts: '1746093600.000100',
      scope: 'org',
    }),
    { confirmedBy: 'U_MAINTAINER', confidence: 0.9 },
  );
}

export function seedLedger(clock: Clock = fixedClock('2026-06-15T12:00:00.000Z')): Ledger {
  const ledger = new Ledger({ clock });
  seedInto(ledger);
  return ledger;
}
