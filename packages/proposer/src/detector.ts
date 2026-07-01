import type { Alternative, Citation } from '@precedent/ledger-core';

import type { DecisionProposal, ThreadContext, ThreadMessage } from './types';

/** Detects a candidate decision in a thread, or `null` if the thread is only discussion. */
export interface Detector {
  detect(context: ThreadContext): Promise<DecisionProposal | null>;
}

const DECISION_CUES: readonly RegExp[] = [
  /\bwe(?:'| a)?re (?:going with|dropping|not doing|sticking with|switching to)\b/i,
  /\blet'?s (?:go with|use|ship|drop)\b/i,
  /\bwe(?:'ll| will| have) (?:decided|use|go with|adopt)\b/i,
  /\bdecision:\s/i,
  /\bwe decided\b/i,
];

/**
 * A deterministic, dependency-free decision detector for the MVP capture path.
 *
 * It favors precision: it proposes only when a message contains an explicit
 * commitment cue. Because a human confirms every proposal (and dismissing is one
 * tap), precision-first is the right default — a missed decision can be captured
 * by hand, while noise erodes trust. Swap in {@link "./llm".LlmDetector} for richer
 * extraction; the confirm loop and ledger are identical either way.
 */
export class HeuristicDetector implements Detector {
  detect(context: ThreadContext): Promise<DecisionProposal | null> {
    const cue = context.messages.find((message) =>
      DECISION_CUES.some((pattern) => pattern.test(message.text)),
    );
    if (cue === undefined) {
      return Promise.resolve(null);
    }

    const proposal: DecisionProposal = {
      statement: firstSentence(cue.text),
      rationale: extractRationale(cue.text),
      alternatives: extractAlternatives(cue.text),
      decidedBy: [cue.userId],
      citations: [toCitation(cue)],
      channelId: context.channelId,
      ...(context.threadTs !== undefined ? { threadTs: context.threadTs } : {}),
      confidence: 0.55,
    };
    return Promise.resolve(proposal);
  }
}

function toCitation(message: ThreadMessage): Citation {
  return {
    permalink: message.permalink,
    channelId: message.channelId,
    ts: message.ts,
    authorId: message.userId,
  };
}

function firstSentence(text: string): string {
  const trimmed = text.trim();
  const end = trimmed.search(/[.!?](\s|$)/);
  return (end === -1 ? trimmed : trimmed.slice(0, end)).trim();
}

function extractRationale(text: string): string {
  const match = text.match(/\b(?:because|since|due to)\b\s+(.+)$/i);
  return match?.[1]?.trim().replace(/[.!?]+$/, '') ?? '';
}

function extractAlternatives(text: string): Alternative[] {
  const match = text.match(/\b(?:over|instead of|rather than)\s+([A-Za-z0-9 ._-]+)/i);
  const raw = match?.[1];
  if (raw === undefined) {
    return [];
  }
  const head = raw.split(/\b(?:because|since|due to|and|but|so)\b/i)[0] ?? raw;
  const option = firstWords(head);
  if (option.length === 0) {
    return [];
  }
  return [{ option, reason: 'Considered and not chosen in the source thread.' }];
}

function firstWords(text: string): string {
  return text.trim().split(/\s+/).slice(0, 4).join(' ').replace(/[.,]+$/, '');
}
