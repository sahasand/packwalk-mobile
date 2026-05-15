/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as conversations from "../conversations.js";
import type * as crons from "../crons.js";
import type * as dogs from "../dogs.js";
import type * as earnings from "../earnings.js";
import type * as emails from "../emails.js";
import type * as http from "../http.js";
import type * as lib_errors from "../lib/errors.js";
import type * as lib_geo from "../lib/geo.js";
import type * as lib_geohash from "../lib/geohash.js";
import type * as lib_guards from "../lib/guards.js";
import type * as lib_notDeleted from "../lib/notDeleted.js";
import type * as lib_rateLimit from "../lib/rateLimit.js";
import type * as lib_torontoNeighborhoods from "../lib/torontoNeighborhoods.js";
import type * as lib_walkToken from "../lib/walkToken.js";
import type * as me from "../me.js";
import type * as messages from "../messages.js";
import type * as notifications from "../notifications.js";
import type * as payments from "../payments.js";
import type * as paymentsMutations from "../paymentsMutations.js";
import type * as reviews from "../reviews.js";
import type * as stripeHttp from "../stripeHttp.js";
import type * as uploads from "../uploads.js";
import type * as users from "../users.js";
import type * as waitlist from "../waitlist.js";
import type * as walkRequests from "../walkRequests.js";
import type * as walkerProfiles from "../walkerProfiles.js";
import type * as walks from "../walks.js";
import type * as webhooks from "../webhooks.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  conversations: typeof conversations;
  crons: typeof crons;
  dogs: typeof dogs;
  earnings: typeof earnings;
  emails: typeof emails;
  http: typeof http;
  "lib/errors": typeof lib_errors;
  "lib/geo": typeof lib_geo;
  "lib/geohash": typeof lib_geohash;
  "lib/guards": typeof lib_guards;
  "lib/notDeleted": typeof lib_notDeleted;
  "lib/rateLimit": typeof lib_rateLimit;
  "lib/torontoNeighborhoods": typeof lib_torontoNeighborhoods;
  "lib/walkToken": typeof lib_walkToken;
  me: typeof me;
  messages: typeof messages;
  notifications: typeof notifications;
  payments: typeof payments;
  paymentsMutations: typeof paymentsMutations;
  reviews: typeof reviews;
  stripeHttp: typeof stripeHttp;
  uploads: typeof uploads;
  users: typeof users;
  waitlist: typeof waitlist;
  walkRequests: typeof walkRequests;
  walkerProfiles: typeof walkerProfiles;
  walks: typeof walks;
  webhooks: typeof webhooks;
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
