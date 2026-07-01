import { type Clock, systemClock } from './clock';
import { decisionId, recordHash } from './hash';
import { InMemoryLedgerStore, type LedgerStore } from './store';
import {
  GENESIS_HASH,
  type DecisionContent,
  type DecisionRecord,
  type DecisionStatus,
} from './types';

export interface AppendOptions {
  /** The human confirming this decision into the ledger. */
  confirmedBy: string;
  /** The model's detection confidence at proposal time, if any. */
  confidence?: number;
}

export interface ChainVerification {
  ok: boolean;
  /** Sequence index of the first broken link, when `ok` is false. */
  brokenAt?: number;
}

/**
 * The deterministic heart of Precedent.
 *
 * The language model proposes; this engine owns the truth. Everything here is
 * exact and none of it is guessed: it mints content-addressed ids, maintains the
 * append-only hash chain, resolves the supersession graph so recall always returns
 * the current head, and can prove its own integrity. It depends only on a
 * {@link LedgerStore} and a {@link Clock}, never on Slack, HTTP, or an LLM.
 */
export class Ledger {
  readonly #store: LedgerStore;
  readonly #clock: Clock;

  constructor(options: { store?: LedgerStore; clock?: Clock } = {}) {
    this.#store = options.store ?? new InMemoryLedgerStore();
    this.#clock = options.clock ?? systemClock;
  }

  /**
   * Append a confirmed decision and return the written record.
   *
   * Idempotent by content address: appending identical content returns the
   * existing record instead of writing a duplicate. A `supersedesId` must refer to
   * a decision already in the ledger.
   */
  append(content: DecisionContent, options: AppendOptions): DecisionRecord {
    const id = decisionId(content);
    const existing = this.#store.getById(id);
    if (existing) {
      return existing;
    }

    if (content.supersedesId !== undefined && this.#store.getById(content.supersedesId) === undefined) {
      throw new Error(`Cannot supersede unknown decision ${content.supersedesId}`);
    }

    const records = this.#store.all();
    const prev = records.at(-1);
    const prevHash = prev ? prev.recordHash : GENESIS_HASH;

    const record: DecisionRecord = {
      id,
      sequence: records.length,
      status: 'confirmed',
      prevHash,
      recordHash: recordHash(prevHash, id),
      confirmedBy: options.confirmedBy,
      confirmedAt: this.#clock().toISOString(),
      ...(options.confidence !== undefined ? { confidence: options.confidence } : {}),
      content,
    };

    this.#store.append(record);
    return record;
  }

  get(id: string): DecisionRecord | undefined {
    return this.#store.getById(id);
  }

  all(): readonly DecisionRecord[] {
    return this.#store.all();
  }

  /** The record that directly supersedes `id`, if one exists. */
  supersessorOf(id: string): DecisionRecord | undefined {
    return this.#store.all().find((record) => record.content.supersedesId === id);
  }

  isSuperseded(id: string): boolean {
    return this.supersessorOf(id) !== undefined;
  }

  /**
   * Follow the supersession chain forward to the current authoritative record.
   * This is the operation search can never do: a reversed decision resolves to the
   * call that replaced it, not to itself.
   */
  resolveHead(id: string): DecisionRecord | undefined {
    let current = this.#store.getById(id);
    if (current === undefined) {
      return undefined;
    }
    const seen = new Set<string>([current.id]);
    for (;;) {
      const next = this.supersessorOf(current.id);
      if (next === undefined) {
        return current;
      }
      if (seen.has(next.id)) {
        throw new Error(`Supersession cycle detected at ${next.id}`);
      }
      seen.add(next.id);
      current = next;
    }
  }

  /** The full supersession chain `id` belongs to, oldest to newest. */
  history(id: string): DecisionRecord[] {
    const start = this.#store.getById(id);
    if (start === undefined) {
      return [];
    }

    let root = start;
    const backGuard = new Set<string>([root.id]);
    while (root.content.supersedesId !== undefined) {
      const parent = this.#store.getById(root.content.supersedesId);
      if (parent === undefined || backGuard.has(parent.id)) {
        break;
      }
      backGuard.add(parent.id);
      root = parent;
    }

    const chain: DecisionRecord[] = [root];
    const seen = new Set<string>([root.id]);
    let cursor: DecisionRecord | undefined = root;
    while (cursor !== undefined) {
      const next = this.supersessorOf(cursor.id);
      if (next === undefined || seen.has(next.id)) {
        break;
      }
      seen.add(next.id);
      chain.push(next);
      cursor = next;
    }
    return chain;
  }

  /** Every decision that is the current head of its chain (superseded by nothing). */
  currentDecisions(): DecisionRecord[] {
    return this.#store.all().filter((record) => !this.isSuperseded(record.id));
  }

  /**
   * The effective status accounting for supersession. Records are stored
   * immutably as `confirmed`; a decision reads as `superseded` or `reversed` only
   * when another record points back at it.
   */
  effectiveStatus(id: string): DecisionStatus | undefined {
    const record = this.#store.getById(id);
    if (record === undefined) {
      return undefined;
    }
    const successor = this.supersessorOf(id);
    if (successor === undefined) {
      return record.status;
    }
    return successor.content.supersessionType === 'reverse' ? 'reversed' : 'superseded';
  }

  /**
   * Recompute the hash chain from genesis to detect tampering, insertion,
   * deletion, or reordering. Correctness here is code, not model output.
   */
  verifyChain(): ChainVerification {
    let prevHash = GENESIS_HASH;
    const records = this.#store.all();
    for (let index = 0; index < records.length; index += 1) {
      const record = records[index]!;
      const expectedId = decisionId(record.content);
      const expectedHash = recordHash(prevHash, expectedId);
      if (
        record.id !== expectedId ||
        record.prevHash !== prevHash ||
        record.recordHash !== expectedHash ||
        record.sequence !== index
      ) {
        return { ok: false, brokenAt: index };
      }
      prevHash = record.recordHash;
    }
    return { ok: true };
  }
}
