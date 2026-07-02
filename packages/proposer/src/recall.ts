import { type DecisionRecord, type Ledger } from '@precedent/ledger-core';

/** The structured answer to "what did we decide about X?" */
export interface DecisionAnswer {
  /** Whether any decision on the topic exists in the ledger. */
  decided: boolean;
  /** The current authoritative decision (supersession already resolved). */
  current?: DecisionRecord;
  /** The full chain, oldest to newest, for "show the history". */
  history: DecisionRecord[];
  /** True when the resolved decision is the head of a supersession chain. */
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

const STOPWORDS = new Set([
  'a', 'an', 'and', 'the', 'of', 'to', 'for', 'on', 'in', 'is', 'are', 'was', 'were', 'be', 'do', 'does', 'did',
  'we', 'our', 'you', 'i', 'it', 'its', 'that', 'this', 'with', 'over', 'than', 'from', 'at', 'by', 'as', 'or',
  'but', 'so', 'if', 'not', 'will', 'would', 'can', 'could', 'should', 'about', 'what', 'which', 'when', 'where',
  'how', 'why', 'decide', 'decided', 'decision', 'use', 'using', 'used',
]);

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
  const history = ledger.history(match.id);
  return {
    decided: true,
    current,
    history,
    wasSuperseded: history.length > 1,
  };
}

function bestMatch(ledger: Ledger, topic: string): DecisionRecord | undefined {
  const terms = meaningfulTokens(topic);
  if (terms.length === 0) {
    return undefined;
  }
  // Require real overlap so a single incidental shared word can't fabricate a
  // confident, cited-looking answer to an unrelated question.
  const required = Math.min(2, terms.length);

  let best: { record: DecisionRecord; score: number } | undefined;
  for (const record of ledger.all()) {
    const haystack = new Set(
      meaningfulTokens(`${record.content.statement} ${record.content.rationale} ${record.content.scope ?? ''}`),
    );
    const score = terms.reduce((sum, term) => sum + (haystack.has(term) ? 1 : 0), 0);
    // `>=` so that on a tie the most recently appended decision wins (recency).
    if (score >= required && (best === undefined || score >= best.score)) {
      best = { record, score };
    }
  }
  return best?.record;
}

function meaningfulTokens(text: string): string[] {
  return (text.toLowerCase().match(/[a-z0-9]+/g) ?? []).filter((token) => token.length > 1 && !STOPWORDS.has(token));
}
