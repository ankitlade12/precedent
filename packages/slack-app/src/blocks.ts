import type { DecisionAnswer, DecisionProposal } from '@precedent/proposer';
import type { KnownBlock } from '@slack/types';

/** Block action ids for the proposal card buttons. */
export const CONFIRM_ACTION = 'precedent_confirm';
export const EDIT_ACTION = 'precedent_edit';
export const DISMISS_ACTION = 'precedent_dismiss';

/**
 * The capture card: a single, unobtrusive Block Kit message posted at the moment a
 * decision is detected — "here's the decision I think was made; log it?" Dismissing
 * is one tap, which is what lets detection favor precision.
 */
export function buildDecisionProposalCard(proposal: DecisionProposal): KnownBlock[] {
  const alternatives =
    proposal.alternatives.length > 0
      ? proposal.alternatives.map((alt) => `• *${alt.option}* — ${alt.reason}`).join('\n')
      : '_None captured._';

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
        { type: 'button', style: 'primary', text: { type: 'plain_text', text: 'Confirm' }, action_id: CONFIRM_ACTION },
        { type: 'button', text: { type: 'plain_text', text: 'Edit' }, action_id: EDIT_ACTION },
        { type: 'button', style: 'danger', text: { type: 'plain_text', text: 'Dismiss' }, action_id: DISMISS_ACTION },
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

function formatUsers(userIds: string[]): string {
  return userIds.length > 0 ? userIds.map((id) => `<@${id}>`).join(', ') : '_unknown_';
}
