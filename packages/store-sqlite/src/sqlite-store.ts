import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname } from 'node:path';
import type { DatabaseSync, StatementSync } from 'node:sqlite';

import type { DecisionRecord, LedgerStore } from '@precedent/ledger-core';

// Load node:sqlite through createRequire with a non-literal specifier so bundlers
// (Vite/esbuild) don't try to resolve this very-new built-in at transform time.
// Only the type import above is static, and type imports are erased.
const sqliteSpecifier = 'node:sqlite';
const { DatabaseSync: Database } = createRequire(import.meta.url)(sqliteSpecifier) as {
  DatabaseSync: new (path: string) => DatabaseSync;
};

const SCHEMA = `
CREATE TABLE IF NOT EXISTS decision_records (
  id           TEXT PRIMARY KEY,
  sequence     INTEGER NOT NULL UNIQUE,
  status       TEXT NOT NULL,
  prev_hash    TEXT NOT NULL,
  record_hash  TEXT NOT NULL,
  confirmed_by TEXT NOT NULL,
  confirmed_at TEXT NOT NULL,
  confidence   REAL,
  content_json TEXT NOT NULL
);
CREATE TRIGGER IF NOT EXISTS decision_records_no_update
  BEFORE UPDATE ON decision_records
  BEGIN SELECT RAISE(ABORT, 'decision_records is append-only'); END;
CREATE TRIGGER IF NOT EXISTS decision_records_no_delete
  BEFORE DELETE ON decision_records
  BEGIN SELECT RAISE(ABORT, 'decision_records is append-only'); END;
`;

/**
 * A durable {@link LedgerStore} backed by SQLite via Node's built-in `node:sqlite`
 * (synchronous, no external dependency). Immutability is enforced by the database
 * itself through BEFORE UPDATE/DELETE triggers — not just in code. Records are
 * cached in memory for fast supersession scans and reloaded from disk on startup,
 * so the ledger survives restarts.
 */
export class SqliteLedgerStore implements LedgerStore {
  readonly #db: DatabaseSync;
  readonly #insert: StatementSync;
  readonly #records: DecisionRecord[] = [];
  readonly #byId = new Map<string, DecisionRecord>();

  constructor(path = 'data/precedent.db') {
    if (path !== ':memory:') {
      mkdirSync(dirname(path), { recursive: true });
    }
    this.#db = new Database(path);
    this.#db.exec('PRAGMA journal_mode = WAL;');
    this.#db.exec(SCHEMA);
    this.#insert = this.#db.prepare(
      `INSERT INTO decision_records
         (id, sequence, status, prev_hash, record_hash, confirmed_by, confirmed_at, confidence, content_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );

    const rows = this.#db
      .prepare('SELECT * FROM decision_records ORDER BY sequence ASC')
      .all() as Array<Record<string, unknown>>;
    for (const row of rows) {
      const record = rowToRecord(row);
      this.#records.push(record);
      this.#byId.set(record.id, record);
    }
  }

  append(record: DecisionRecord): void {
    if (this.#byId.has(record.id)) {
      throw new Error(`Ledger is append-only and already contains ${record.id}`);
    }
    this.#insert.run(
      record.id,
      record.sequence,
      record.status,
      record.prevHash,
      record.recordHash,
      record.confirmedBy,
      record.confirmedAt,
      record.confidence ?? null,
      JSON.stringify(record.content),
    );
    this.#records.push(record);
    this.#byId.set(record.id, record);
  }

  getById(id: string): DecisionRecord | undefined {
    return this.#byId.get(id);
  }

  all(): readonly DecisionRecord[] {
    return this.#records;
  }

  size(): number {
    return this.#records.length;
  }

  /** Close the underlying database handle. */
  close(): void {
    this.#db.close();
  }
}

function rowToRecord(row: Record<string, unknown>): DecisionRecord {
  const confidence = row['confidence'];
  return {
    id: String(row['id']),
    sequence: Number(row['sequence']),
    status: String(row['status']) as DecisionRecord['status'],
    prevHash: String(row['prev_hash']),
    recordHash: String(row['record_hash']),
    confirmedBy: String(row['confirmed_by']),
    confirmedAt: String(row['confirmed_at']),
    ...(confidence !== null && confidence !== undefined ? { confidence: Number(confidence) } : {}),
    content: JSON.parse(String(row['content_json'])) as DecisionRecord['content'],
  };
}
