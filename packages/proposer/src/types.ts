import type { Alternative, Citation, DecisionContent, SupersessionType } from '@precedent/ledger-core';

/** A single message in a thread, with the permalink used for provenance. */
export interface ThreadMessage {
  userId: string;
  text: string;
  ts: string;
  channelId: string;
  permalink: string;
}

/** The slice of conversation a detector reasons over. */
export interface ThreadContext {
  channelId: string;
  threadTs?: string;
  messages: ThreadMessage[];
}

/**
 * A candidate decision proposed from a thread. It is NOT yet in the ledger — a
 * human confirms, edits, or dismisses it first. On confirm it is converted to the
 * immutable {@link DecisionContent} the deterministic Ledger appends.
 */
export interface DecisionProposal {
  statement: string;
  rationale: string;
  alternatives: Alternative[];
  decidedBy: string[];
  citations: Citation[];
  channelId: string;
  threadTs?: string;
  /** Detection confidence in [0, 1]. */
  confidence: number;
}

export interface ConfirmOptions {
  decidedAt: string;
  type?: DecisionContent['type'];
  scope?: string;
  supersedesId?: string;
  supersessionType?: SupersessionType;
}

/** Convert a human-confirmed proposal into the immutable content the Ledger stores. */
export function toDecisionContent(proposal: DecisionProposal, options: ConfirmOptions): DecisionContent {
  return {
    statement: proposal.statement,
    type: options.type ?? 'other',
    rationale: proposal.rationale,
    alternatives: proposal.alternatives,
    decidedBy: proposal.decidedBy,
    decidedAt: options.decidedAt,
    citations: proposal.citations,
    channelId: proposal.channelId,
    ...(proposal.threadTs !== undefined ? { threadTs: proposal.threadTs } : {}),
    ...(options.scope !== undefined ? { scope: options.scope } : {}),
    ...(options.supersedesId !== undefined ? { supersedesId: options.supersedesId } : {}),
    ...(options.supersessionType !== undefined ? { supersessionType: options.supersessionType } : {}),
  };
}
