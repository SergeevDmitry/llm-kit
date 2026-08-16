/**
 * `chat-fit/models` — an optional, model-aware budget helper backed by the
 * bundled `@llm-kit/model-registry`.
 *
 * Deliberately a separate entry point from the package root: `fitChat`/
 * `fitChatAsync` must work from an explicit `maxTokens` with zero registry
 * involvement, so every caller who only ever passes a budget number never
 * pulls model-registry data into their bundle. Import from `chat-fit/models`
 * only when a model id, not a token count, is what you actually have on
 * hand — hand-copying a model's context window into `maxTokens` is exactly
 * the stale-constant bug a versioned registry exists to prevent.
 */
import {
  MODEL_REGISTRY,
  resolveModel,
  type ModelDescriptor,
  type ProviderId,
} from '@llm-kit/model-registry';
import { fitChat } from './fit-chat.js';
import type { ChatMessage, FitChatOptions, FitChatResult } from './types.js';

export {
  AmbiguousAliasError,
  UnknownModelError,
  InvalidLookupDateError,
  type ModelCandidate,
} from '@llm-kit/model-registry';

/**
 * Raised by `resolveModelBudget`/`fitChatForModel` when `modelId` resolves
 * to a real registry entry that has no recorded `contextWindow` — most of
 * the bundled registry today, outside the Claude family it was measured
 * against. Silently falling back to `Infinity` or some arbitrary constant
 * here would produce a budget the caller trusts built from data the
 * registry does not actually have — worse than failing loudly, since a
 * caller has no way to tell a real, sourced number from a guess. Pass
 * `maxTokens` explicitly for a model this applies to.
 */
export class ModelContextWindowUnknownError extends Error {
  readonly code = 'MODEL_CONTEXT_WINDOW_UNKNOWN';
  readonly canonicalModel: string;
  readonly provider: string;

  constructor(canonicalModel: string, provider: string) {
    super(
      `Model "${provider}:${canonicalModel}" resolved, but the bundled registry has no recorded context window for it — a budget cannot be derived from it. Pass maxTokens explicitly instead.`,
    );
    this.name = 'ModelContextWindowUnknownError';
    this.canonicalModel = canonicalModel;
    this.provider = provider;
  }
}

export interface ResolveModelBudgetOptions {
  /** Tokens set aside for the model's reply. Echoed back on the result unchanged; default 0. */
  readonly reserveTokens?: number;
  /**
   * Restricts resolution to one provider — required when `modelId` is a
   * canonical id or alias registered under more than one (e.g. `gpt-4.1`
   * under both `openai` and `azure-openai`); otherwise resolution throws
   * `AmbiguousAliasError`. See `@llm-kit/model-registry`'s `resolveModel`.
   */
  readonly provider?: ProviderId;
  /** Custom or negotiated model entries checked before the bundled registry. */
  readonly overrides?: readonly ModelDescriptor[];
  /** Canonical id to fall back to when `modelId` matches nothing else. */
  readonly fallback?: string;
}

export interface ModelBudget {
  /** The resolved model's context window, in tokens. */
  readonly maxTokens: number;
  /** `options.reserveTokens`, defaulted to 0 — present so the result spreads straight into `fitChat`/`fitChatAsync`. */
  readonly reserveTokens: number;
}

/**
 * Resolves `modelId` against the bundled registry and returns its context
 * window as a `{ maxTokens, reserveTokens }` pair ready to spread into
 * `fitChat`/`fitChatAsync`.
 *
 * Propagates `UnknownModelError` (code `UNKNOWN_MODEL`) and
 * `AmbiguousAliasError` (code `AMBIGUOUS_ALIAS`) unchanged from
 * `@llm-kit/model-registry` — this function is a thin resolution wrapper,
 * not a new error taxonomy, the same way `usage-tab` propagates the same
 * two classes from its own `resolveModel`. Throws
 * {@link ModelContextWindowUnknownError} (code
 * `MODEL_CONTEXT_WINDOW_UNKNOWN`) when `modelId` resolves but has no
 * recorded context window.
 */
export function resolveModelBudget(
  modelId: string,
  options: ResolveModelBudgetOptions = {},
): ModelBudget {
  const resolved = resolveModel(modelId, MODEL_REGISTRY, {
    provider: options.provider,
    overrides: options.overrides,
    fallback: options.fallback,
  });
  const { contextWindow } = resolved.descriptor;
  if (contextWindow === undefined) {
    throw new ModelContextWindowUnknownError(
      resolved.descriptor.canonicalId,
      resolved.descriptor.provider,
    );
  }
  return { maxTokens: contextWindow, reserveTokens: options.reserveTokens ?? 0 };
}

export interface FitChatForModelOptions<Message = ChatMessage>
  extends
    Omit<FitChatOptions<Message>, 'maxTokens' | 'strategy' | 'summary'>,
    Omit<ResolveModelBudgetOptions, 'reserveTokens'> {
  /** `'drop-oldest'` only — `fitChatForModel` is sugar over the synchronous `fitChat`. */
  readonly strategy?: 'drop-oldest';
  /** Model id to resolve against the bundled registry — see {@link resolveModelBudget}. */
  readonly model: string;
  /**
   * Overrides the registry-resolved context window. When set, registry
   * resolution for the budget is skipped entirely — an unresolvable
   * `model` never throws when `maxTokens` is supplied explicitly.
   */
  readonly maxTokens?: number;
}

/** Sugar over `fitChat` that resolves `options.model` to a `maxTokens` budget via {@link resolveModelBudget} instead of requiring one directly. */
export function fitChatForModel<Message = ChatMessage>(
  messages: readonly Message[],
  options: FitChatForModelOptions<Message>,
): FitChatResult<Message> {
  const { model, provider, overrides, fallback, maxTokens, ...fitOptions } = options;
  const resolvedMaxTokens =
    maxTokens ?? resolveModelBudget(model, { provider, overrides, fallback }).maxTokens;
  return fitChat(messages, { ...fitOptions, maxTokens: resolvedMaxTokens });
}
