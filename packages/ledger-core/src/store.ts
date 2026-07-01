import type { DecisionRecord } from './types';

/**
 * Persistence port for the ledger. Deliberately append-only: there is no update
 * or delete. Adapters implement this interface — {@link InMemoryLedgerStore} for
 * tests and dev, a libSQL/Drizzle adapter for production — while the ledger's
 * correctness lives above it, in code, independent of the backing store.
 */
export interface LedgerStore {
  /** Append a record. Implementations must reject a duplicate id. */
  append(record: DecisionRecord): void;
  getById(id: string): DecisionRecord | undefined;
  /** All records in append order. */
  all(): readonly DecisionRecord[];
  size(): number;
}

/** An in-memory, append-only store. Fast and dependency-free for tests and dev. */
export class InMemoryLedgerStore implements LedgerStore {
  readonly #records: DecisionRecord[] = [];
  readonly #byId = new Map<string, DecisionRecord>();

  append(record: DecisionRecord): void {
    if (this.#byId.has(record.id)) {
      throw new Error(`Ledger is append-only and already contains ${record.id}`);
    }
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
}
