/**
 * The decision record schema — the data model that IS the product.
 *
 * A decision has two layers:
 *  - {@link DecisionContent}: the immutable, semantic payload. It alone determines
 *    a decision's content-addressed identity (see `hash.ts`). Two captures of the
 *    same decision produce the same id, which is what makes capture idempotent.
 *  - {@link DecisionRecord}: the content plus ledger metadata (id, sequence, and the
 *    hash-chain links) written when a human confirms the decision into the ledger.
 *
 * Everything the model proposes lives in `DecisionContent`; the deterministic
 * engine owns everything in the record wrapper. The ledger never mutates a record,
 * so lifecycle transitions (supersession, reversal) are expressed as *new* records
 * that point back at the ones they replace — never as edits.
 */

export type DecisionType =
  | 'technical'
  | 'process'
  | 'policy'
  | 'governance'
  | 'product'
  | 'other';

/**
 * Stored status. Records are written as `confirmed` and never mutated; the
 * effective status of a superseded/reversed decision is derived at read time by
 * {@link "./ledger".Ledger.effectiveStatus}, not stored.
 */
export type DecisionStatus = 'confirmed' | 'superseded' | 'reversed' | 'amended';

/** How a later decision relates to the one it replaces. */
export type SupersessionType = 'supersede' | 'reverse' | 'amend';

/** An option that was considered and rejected, with the reason it lost. */
export interface Alternative {
  option: string;
  reason: string;
}

/**
 * A link to an exact source message. This is the anti-hallucination guarantee:
 * every record and every recalled answer is grounded in real Slack permalinks.
 */
export interface Citation {
  permalink: string;
  channelId: string;
  ts: string;
  authorId?: string;
}

/** The immutable, identity-bearing content of a decision. */
export interface DecisionContent {
  /** The decision in one line. */
  statement: string;
  type: DecisionType;
  /** Why, grounded in the source conversation. */
  rationale: string;
  /** Rejected options — often more valuable than the chosen one. */
  alternatives: Alternative[];
  /** The people who made the call, resolved to Slack user IDs. */
  decidedBy: string[];
  /** When the decision was made (ISO 8601), from the source messages. */
  decidedAt: string;
  /** The exact source messages this record is grounded in. */
  citations: Citation[];
  channelId: string;
  threadTs?: string;
  /** Project, repo, component, or team this decision applies to. */
  scope?: string;
  /** The id of the decision this one overrides, if any. */
  supersedesId?: string;
  /** Whether this replaces, reverses, or amends {@link supersedesId}. */
  supersessionType?: SupersessionType;
}

/** A confirmed, immutable ledger entry. */
export interface DecisionRecord {
  /** Content-addressed identifier, e.g. `DR-a1b2c3d4e5f6`. */
  id: string;
  /** Append order, 0-based. */
  sequence: number;
  status: DecisionStatus;
  /** Previous record's `recordHash` (`GENESIS_HASH` for the first record). */
  prevHash: string;
  /** Tamper-evident chain link: `sha256(prevHash + id)`. */
  recordHash: string;
  /** The human who confirmed the record into the ledger. */
  confirmedBy: string;
  /** When it was confirmed (ISO 8601), from the injected clock. */
  confirmedAt: string;
  /** The model's detection confidence at proposal time — metadata, not identity. */
  confidence?: number;
  content: DecisionContent;
}

/** The prevHash of the first record in a chain. */
export const GENESIS_HASH = '';
