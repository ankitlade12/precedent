import type { DecisionRecord } from '@precedent/ledger-core';
import type { DecisionAnswer, DecisionProposal, SourceMessage } from '@precedent/proposer';
import type { KnownBlock } from '@slack/types';

/** Block action ids for the proposal card buttons. */
export const CONFIRM_ACTION = 'precedent_confirm';
export const EDIT_ACTION = 'precedent_edit';
export const DISMISS_ACTION = 'precedent_dismiss';

/**
 * The capture card: a single, unobtrusive Block Kit message posted at the moment a
 * decision is detected — "here's the decision I think was made; log it?" Dismissing
 * is one tap, which is what lets detection favor precision. `token` correlates the
 * buttons back to the pending proposal held by the app.
 */
export function buildDecisionProposalCard(proposal: DecisionProposal, token?: string): KnownBlock[] {
  const alternatives =
    proposal.alternatives.length > 0
      ? proposal.alternatives.map((alt) => `• *${alt.option}* — ${alt.reason}`).join('\n')
      : '_None captured._';

  const value = token ?? '';

  return [
    {
      type: 'section',
      text: { type: 'mrkdwn', text: `*I think a decision was just made:*\n> ${proposal.statement}` },
    },
    {
      type: 'section',
      fields: [
        { type: 'mrkdwn', text: `*Rationale*\n${proposal.rationale || '_n/a_'}` },
        { type: 'mrkdwn', text: `*Decided by*\n${formatUsers(proposal.decidedBy)}` },
      ],
    },
    { type: 'section', text: { type: 'mrkdwn', text: `*Rejected alternatives*\n${alternatives}` } },
    {
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: `Confidence ${(proposal.confidence * 100).toFixed(0)}% · grounded in ${proposal.citations.length} message(s)`,
        },
      ],
    },
    {
      type: 'actions',
      elements: [
        { type: 'button', style: 'primary', text: { type: 'plain_text', text: 'Confirm' }, action_id: CONFIRM_ACTION, value },
        { type: 'button', text: { type: 'plain_text', text: 'Edit' }, action_id: EDIT_ACTION, value },
        { type: 'button', style: 'danger', text: { type: 'plain_text', text: 'Dismiss' }, action_id: DISMISS_ACTION, value },
      ],
    },
  ];
}

/**
 * The recall answer, with receipts: the current decision, the rationale, the
 * rejected alternatives, who decided, a supersession warning when relevant, and
 * links to the exact source messages.
 */
export function buildRecallAnswer(topic: string, answer: DecisionAnswer): KnownBlock[] {
  if (!answer.decided || answer.current === undefined) {
    return [
      { type: 'section', text: { type: 'mrkdwn', text: `I don't have a recorded decision about *${topic}* yet.` } },
    ];
  }

  const current = answer.current;
  const blocks: KnownBlock[] = [
    { type: 'section', text: { type: 'mrkdwn', text: `*Decision:* ${current.content.statement}` } },
    {
      type: 'section',
      fields: [
        { type: 'mrkdwn', text: `*Why*\n${current.content.rationale || '_n/a_'}` },
        { type: 'mrkdwn', text: `*Decided by*\n${formatUsers(current.content.decidedBy)}` },
      ],
    },
  ];

  if (current.content.alternatives.length > 0) {
    const rejected = current.content.alternatives.map((alt) => `• *${alt.option}* — ${alt.reason}`).join('\n');
    blocks.push({ type: 'section', text: { type: 'mrkdwn', text: `*Rejected*\n${rejected}` } });
  }

  if (answer.wasSuperseded) {
    blocks.push({
      type: 'context',
      elements: [
        { type: 'mrkdwn', text: `:warning: This overturned an earlier call — ${answer.history.length} versions on record.` },
      ],
    });
  }

  const receipts = current.content.citations
    .map((citation, index) => `<${citation.permalink}|source ${index + 1}>`)
    .join(' · ');
  if (receipts.length > 0) {
    blocks.push({ type: 'context', elements: [{ type: 'mrkdwn', text: `Receipts: ${receipts} · \`${current.id}\`` }] });
  }

  return blocks;
}

/**
 * On a recall miss, offer the likely source threads found via the Real-Time Search
 * API so the user can capture a decision that predates the ledger.
 */
export function buildBackfillPrompt(topic: string, candidates: SourceMessage[]): KnownBlock[] {
  if (candidates.length === 0) {
    return [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `I don't have a recorded decision about *${topic}* yet, and I couldn't find a likely source thread.`,
        },
      },
    ];
  }

  const list = candidates
    .slice(0, 5)
    .map((candidate, index) => `${index + 1}. <${candidate.permalink}|source> — ${truncate(candidate.text, 140)}`)
    .join('\n');

  return [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `I don't have a *logged* decision about *${topic}* yet — but these threads look relevant. Open one and use the *Log this decision* shortcut to capture it:`,
      },
    },
    { type: 'section', text: { type: 'mrkdwn', text: list } },
  ];
}

/**
 * The relitigation guard: when a settled question resurfaces, surface the current
 * decision in-thread so the team doesn't re-debate it. This is the feature that
 * stops the waste at the source.
 */
export function buildRelitigationNudge(answer: DecisionAnswer): KnownBlock[] {
  if (!answer.decided || answer.current === undefined) {
    return [];
  }
  const current = answer.current;
  const receipt = current.content.citations[0]?.permalink;
  const blocks: KnownBlock[] = [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `:memo: Heads up — this looks settled. The team decided: *${current.content.statement}*${receipt ? ` (<${receipt}|source>)` : ''}`,
      },
    },
  ];
  if (answer.wasSuperseded) {
    blocks.push({
      type: 'context',
      elements: [{ type: 'mrkdwn', text: `This is the current call — ${answer.history.length} versions on record.` }],
    });
  }
  blocks.push({
    type: 'context',
    elements: [{ type: 'mrkdwn', text: 'Ask `/precedent why …` for the full rationale and alternatives.' }],
  });
  return blocks;
}

/** A newcomer's onboarding brief: the current decisions a new contributor should know. */
export function buildOnboardingBrief(decisions: DecisionRecord[]): KnownBlock[] {
  if (decisions.length === 0) {
    return [{ type: 'section', text: { type: 'mrkdwn', text: 'No decisions on record yet.' } }];
  }
  const lines = decisions
    .slice(0, 20)
    .map((decision) => {
      const receipt = decision.content.citations[0]?.permalink;
      const link = receipt ? ` <${receipt}|↗>` : '';
      return `• *${decision.content.statement}* — _${decision.content.type}_${link}`;
    })
    .join('\n');
  return [
    { type: 'header', text: { type: 'plain_text', text: 'Decisions a new contributor should know' } },
    { type: 'section', text: { type: 'mrkdwn', text: lines } },
    {
      type: 'context',
      elements: [
        { type: 'mrkdwn', text: `${decisions.length} current decision(s) · ask \`/precedent why <topic>\` for the rationale` },
      ],
    },
  ];
}

function formatUsers(userIds: string[]): string {
  return userIds.length > 0 ? userIds.map((id) => `<@${id}>`).join(', ') : '_unknown_';
}

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}
