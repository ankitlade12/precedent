import { type DecisionRecord, type Ledger } from '@precedent/ledger-core';

/** The structured answer to "what did we decide about X?" */
export interface DecisionAnswer {
  /** Whether any decision on the topic exists in the ledger. */
  decided: boolean;
  /** The current authoritative decision (supersession already resolved). */
  current?: DecisionRecord;
  /** The full chain, oldest to newest, for "show the history". */
  history: DecisionRecord[];
  /** True when the current call differs from the earliest match on the topic. */
  wasSuperseded: boolean;
}

export interface SourceMessage {
  permalink: string;
  channelId: string;
  ts: string;
  text: string;
}

/**
 * RTS backfill port: for decisions older than the ledger, search Slack
 * conversation to find likely source threads and offer to create a record.
 * Implemented in production by `assistant.search.context` (the Real-Time Search
 * API). Keeping it a port means day one is useful instead of an empty database.
 */
export interface SearchClient {
  searchContext(query: string): Promise<SourceMessage[]>;
}

/**
 * Deterministic structured recall over the ledger. Given a topic, find the best
 * matching decision, resolve supersession, and return the CURRENT call plus its
 * history. Recall correctness is code, not model output: a reversed decision is
 * never returned as current without the correction.
 */
export function recall(ledger: Ledger, topic: string): DecisionAnswer {
  const match = bestMatch(ledger, topic);
  if (match === undefined) {
    return { decided: false, history: [], wasSuperseded: false };
  }
  const current = ledger.resolveHead(match.id) ?? match;
  return {
    decided: true,
    current,
    history: ledger.history(match.id),
    wasSuperseded: current.id !== match.id,
  };
}

function bestMatch(ledger: Ledger, topic: string): DecisionRecord | undefined {
  const terms = tokenize(topic);
  if (terms.length === 0) {
    return undefined;
  }
  let best: { record: DecisionRecord; score: number } | undefined;
  for (const record of ledger.all()) {
    const haystack = tokenize(
      `${record.content.statement} ${record.content.rationale} ${record.content.scope ?? ''}`,
    );
    const score = terms.reduce((sum, term) => sum + (haystack.includes(term) ? 1 : 0), 0);
    if (score > 0 && (best === undefined || score > best.score)) {
      best = { record, score };
    }
  }
  return best?.record;
}

function tokenize(text: string): string[] {
  return text.toLowerCase().match(/[a-z0-9]+/g) ?? [];
}
