import { createHash } from 'node:crypto';

import { canonicalize } from './canonical';
import type { Citation, DecisionContent } from './types';

/** Hex-encoded SHA-256 of a UTF-8 string. */
export function sha256(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex');
}

/**
 * Content-addressed decision id, derived purely from the decision's semantic
 * content. The same decision always yields the same id (enabling dedup); any
 * change to the content changes it (enabling tamper detection).
 *
 * `decidedBy` and `citations` are sorted before hashing because they are
 * unordered *sets* in meaning — listing the deciders in a different order is the
 * same decision. `alternatives` order is preserved, because it is meaningful.
 */
export function decisionId(content: DecisionContent): string {
  const normalized = {
    ...content,
    decidedBy: [...content.decidedBy].sort(),
    citations: [...content.citations].sort(byCitation),
  };
  return `DR-${sha256(canonicalize(normalized)).slice(0, 12)}`;
}

function byCitation(a: Citation, b: Citation): number {
  return a.ts.localeCompare(b.ts) || a.permalink.localeCompare(b.permalink);
}

/**
 * Hash-chain link for tamper evidence. Each record commits to the previous
 * record's hash, its content-addressed id, AND its provenance metadata (who
 * confirmed it, when, and the detection confidence) — so a decision's *receipts*
 * are tamper-evident, not just its statement. Recomputing the chain detects any
 * edit, insertion, deletion, or reordering.
 */
export function recordHash(
  prevHash: string,
  id: string,
  confirmedBy: string,
  confirmedAt: string,
  confidence?: number,
): string {
  return sha256(`${prevHash}|${id}|${confirmedBy}|${confirmedAt}|${confidence ?? ''}`);
}
