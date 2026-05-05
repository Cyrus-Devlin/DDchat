/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as claudeTools from "../claudeTools.js";
import type * as coachConversations from "../coachConversations.js";
import type * as coachMessages from "../coachMessages.js";
import type * as coachTools from "../coachTools.js";
import type * as conversations from "../conversations.js";
import type * as customers from "../customers.js";
import type * as feedback from "../feedback.js";
import type * as knowledge from "../knowledge.js";
import type * as messages from "../messages.js";
import type * as nurses from "../nurses.js";
import type * as promptVersions from "../promptVersions.js";
import type * as rules from "../rules.js";
import type * as seed from "../seed.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  claudeTools: typeof claudeTools;
  coachConversations: typeof coachConversations;
  coachMessages: typeof coachMessages;
  coachTools: typeof coachTools;
  conversations: typeof conversations;
  customers: typeof customers;
  feedback: typeof feedback;
  knowledge: typeof knowledge;
  messages: typeof messages;
  nurses: typeof nurses;
  promptVersions: typeof promptVersions;
  rules: typeof rules;
  seed: typeof seed;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
