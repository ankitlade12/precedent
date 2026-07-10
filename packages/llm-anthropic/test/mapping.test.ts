import type { ThreadContext } from '@precedent/proposer';
import { describe, expect, it } from 'vitest';

import { type Extraction, toProposal } from '../src/client';

function ctx(): ThreadContext {
  return {
    channelId: 'C1',
    threadTs: '1.1',
    messages: [
      { userId: 'U1', text: 'what database should we use?', ts: '1.1', channelId: 'C1', permalink: 'https://x.slack.com/p1' },
      { userId: 'U2', text: "we're going with Postgres", ts: '2.2', channelId: 'C1', permalink: 'https://x.slack.com/p2' },
    ],
  };
}

const detected: Extraction = {
  decisionMade: true,
  statement: 'Use Postgres as the primary database',
  rationale: 'Relational integrity and the team knows it',
  alternatives: [{ option: 'DynamoDB', reason: 'overkill for our write volume' }],
  decisionType: 'technical',
  scope: 'storage',
  deciderIds: ['U2'],
  sourceTs: ['2.2'],
  confidence: 0.9,
};

describe('toProposal', () => {
  it('maps a detected decision onto a grounded proposal', () => {
    const proposal = toProposal(detected, ctx());
    expect(proposal).not.toBeNull();
    expect(proposal?.statement).toBe('Use Postgres as the primary database');
    expect(proposal?.citations[0]?.permalink).toBe('https://x.slack.com/p2');
    expect(proposal?.decidedBy).toEqual(['U2']);
    expect(proposal?.alternatives[0]?.option).toBe('DynamoDB');
    expect(proposal?.type).toBe('technical');
    expect(proposal?.scope).toBe('storage');
    expect(proposal?.confidence).toBe(0.9);
  });

  it('returns null when no decision was made or confidence is low', () => {
    const none: Extraction = { decisionMade: false, statement: '', rationale: '', alternatives: [], decisionType: 'other', scope: '', deciderIds: [], sourceTs: [], confidence: 0.1 };
    expect(toProposal(none, ctx())).toBeNull();
    expect(toProposal({ ...detected, confidence: 0.2 }, ctx())).toBeNull();
    expect(toProposal({ ...detected, statement: '   ' }, ctx())).toBeNull();
  });

  it('grounds on the most recent message when the model cites nothing that resolves', () => {
    const proposal = toProposal({ ...detected, sourceTs: ['9.9'], deciderIds: [] }, ctx());
    expect(proposal?.citations[0]?.ts).toBe('2.2');
    expect(proposal?.decidedBy).toEqual(['U2']);
  });
});
