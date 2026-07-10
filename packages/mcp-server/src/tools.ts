import type { DecisionRecord, Ledger } from '@precedent/ledger-core';
import { recall } from '@precedent/proposer';

/** A decision as returned over MCP — a stable, agent-friendly projection of a record. */
export interface DecisionDto {
  id: string;
  statement: string;
  status: string;
  rationale: string;
  alternatives: { option: string; reason: string }[];
  decidedBy: string[];
  decidedAt: string;
  channelId: string;
  scope?: string;
  citations: { permalink: string; channelId: string; ts: string }[];
}

export interface HasThisBeenDecidedResult {
  decided: boolean;
  current?: DecisionDto;
  /** The full supersession chain, oldest to newest. */
  history: DecisionDto[];
  wasSuperseded: boolean;
}

/**
 * The check other agents call before they act. Returns the CURRENT decision on a
 * topic (supersession resolved), its history, and the source permalinks — so an
 * agent is anchored to what was actually decided, not a stale or invented answer.
 */
export function hasThisBeenDecided(ledger: Ledger, topic: string, channelId?: string): HasThisBeenDecidedResult {
  const answer = recall(ledger, topic, channelId === undefined ? undefined : { channelIds: [channelId] });
  if (!answer.decided || answer.current === undefined) {
    return { decided: false, history: [], wasSuperseded: false };
  }
  return {
    decided: true,
    current: toDto(ledger, answer.current),
    history: answer.history.map((record) => toDto(ledger, record)),
    wasSuperseded: answer.wasSuperseded,
  };
}

export function getDecision(ledger: Ledger, id: string): DecisionDto | undefined {
  const record = ledger.get(id);
  return record === undefined ? undefined : toDto(ledger, record);
}

export function listDecisions(ledger: Ledger, channelId?: string): DecisionDto[] {
  return ledger
    .currentDecisions()
    .filter((record) => channelId === undefined || record.content.channelId === channelId)
    .map((record) => toDto(ledger, record));
}

function toDto(ledger: Ledger, record: DecisionRecord): DecisionDto {
  return {
    id: record.id,
    statement: record.content.statement,
    status: ledger.effectiveStatus(record.id) ?? record.status,
    rationale: record.content.rationale,
    alternatives: record.content.alternatives,
    decidedBy: record.content.decidedBy,
    decidedAt: record.content.decidedAt,
    channelId: record.content.channelId,
    ...(record.content.scope !== undefined ? { scope: record.content.scope } : {}),
    citations: record.content.citations.map((citation) => ({
      permalink: citation.permalink,
      channelId: citation.channelId,
      ts: citation.ts,
    })),
  };
}
