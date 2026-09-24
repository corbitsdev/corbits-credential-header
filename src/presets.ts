import {
  createHeaderCredentialProvider,
  type FetchLike,
} from "./header-credential-provider.js";
import type { CredentialProvider } from "@intx/types";

export interface HeaderPresetOptions {
  /** Injectable `fetch` for tests; defaults to the global `fetch`. */
  fetch?: FetchLike;
}

/** Provider plugin key for the `x-api-key` preset. */
export const X_API_KEY_PROVIDER_KEY = "http-x-api-key";

/**
 * `x-api-key` preset: sends the secret verbatim in an `x-api-key` header.
 * Fits APIs like Exa's and ScrapeCreators' that authenticate this way
 * instead of `authorization` in any shape.
 */
export function xApiKeyCredentialProvider(
  opts?: HeaderPresetOptions,
): CredentialProvider {
  return createHeaderCredentialProvider({
    key: X_API_KEY_PROVIDER_KEY,
    header: "x-api-key",
    ...(opts?.fetch !== undefined ? { fetch: opts.fetch } : {}),
  });
}

/** Provider plugin key for the raw-`authorization` preset. */
export const RAW_AUTHORIZATION_PROVIDER_KEY = "http-raw-authorization";

/**
 * Raw-`authorization` preset: sends the secret verbatim in `authorization`,
 * with no `Bearer ` prefix. Fits APIs like Linear's that expect the raw
 * key in that header instead of a bearer token.
 */
export function rawAuthorizationCredentialProvider(
  opts?: HeaderPresetOptions,
): CredentialProvider {
  return createHeaderCredentialProvider({
    key: RAW_AUTHORIZATION_PROVIDER_KEY,
    header: "authorization",
    ...(opts?.fetch !== undefined ? { fetch: opts.fetch } : {}),
  });
}
