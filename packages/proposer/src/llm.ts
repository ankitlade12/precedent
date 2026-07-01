import type { Detector } from './detector';
import type { DecisionProposal, ThreadContext } from './types';

/**
 * Provider-agnostic LLM port. The deterministic ledger core never depends on this;
 * everything the model returns is a proposal a human confirms. Implement it with
 * an Anthropic/OpenAI client or the Slack agent SDK.
 */
export interface LlmClient {
  proposeDecision(context: ThreadContext): Promise<DecisionProposal | null>;
}

/**
 * The production detector: delegates extraction to an LLM behind {@link LlmClient}.
 * A real implementation would cheaply pre-filter threads, then ask the model to
 * extract the statement, rationale, rejected alternatives, and deciders, and to
 * suggest which prior decision this one might supersede — all as a proposal.
 */
export class LlmDetector implements Detector {
  readonly #llm: LlmClient;

  constructor(llm: LlmClient) {
    this.#llm = llm;
  }

  detect(context: ThreadContext): Promise<DecisionProposal | null> {
    // TODO: pre-filter with cheap heuristics before spending a model call.
    return this.#llm.proposeDecision(context);
  }
}
