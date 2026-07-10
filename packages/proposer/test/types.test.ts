import { describe, expect, it } from 'vitest';

import { toDecisionContent, type DecisionProposal } from '../src/types';

const proposal: DecisionProposal = {
  statement: 'Use SQLite instead of Postgres',
  rationale: 'It is simpler for a volunteer team to operate.',
  alternatives: [{ option: 'Postgres', reason: 'More infrastructure than the project needs.' }],
  decidedBy: ['U1'],
  citations: [{ permalink: 'https://acme.slack.com/archives/C1/p1', channelId: 'C1', ts: '1.1' }],
  channelId: 'C1',
  type: 'technical',
  scope: 'storage',
  supersedesId: 'DR-earlier',
  supersessionType: 'reverse',
  confidence: 0.9,
};

describe('toDecisionContent', () => {
  it('carries human-reviewed lifecycle metadata into the immutable record content', () => {
    const content = toDecisionContent(proposal, { decidedAt: '2026-07-10T00:00:00.000Z' });
    expect(content.type).toBe('technical');
    expect(content.scope).toBe('storage');
    expect(content.supersedesId).toBe('DR-earlier');
    expect(content.supersessionType).toBe('reverse');
  });

  it('allows explicit confirm options to override proposal metadata', () => {
    const content = toDecisionContent(proposal, {
      decidedAt: '2026-07-10T00:00:00.000Z',
      type: 'product',
      scope: 'web',
      supersedesId: 'DR-newer',
      supersessionType: 'amend',
    });
    expect(content).toMatchObject({
      type: 'product',
      scope: 'web',
      supersedesId: 'DR-newer',
      supersessionType: 'amend',
    });
  });
});
