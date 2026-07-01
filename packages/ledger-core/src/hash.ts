import { createHash } from 'node:crypto';

import { canonicalize } from './canonical';
import type { DecisionContent } from './types';

/** Hex-encoded SHA-256 of a UTF-8 string. */
export function sha256(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex');
}

/**
 * Content-addressed decision id. Derived purely from the decision's semantic
 * content, so the same decision always yields the same id (enabling dedup) and any
 * change to the content changes the id (enabling tamper detection).
 */
export function decisionId(content: DecisionContent): string {
  return `DR-${sha256(canonicalize(content)).slice(0, 12)}`;
}

/**
 * Hash-chain link for tamper evidence: each record commits to the previous
 * record's hash plus its own content-addressed id. Recomputing the chain detects
 * any edit, insertion, deletion, or reordering.
 */
export function recordHash(prevHash: string, id: string): string {
  return sha256(prevHash + id);
}
