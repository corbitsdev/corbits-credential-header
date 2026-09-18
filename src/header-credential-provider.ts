// A header-shaped `CredentialProvider` for Interchange: sends a secret in
// an arbitrary header, optionally prefixed (e.g. `Bearer <secret>`).
// `@intx/harness`'s vendored `createHttpCredentialProvider` always sends
// `authorization: Bearer <secret>` -- correct for a bearer-token API, but
// wrong for an API that expects the raw key with no prefix (Linear's
// `authorization` convention) or a different header entirely
// (`x-api-key`, or any other name a vendor picks). `createHeaderCredentialProvider`
// covers all three by taking the header name and an optional prefix as
// configuration.
//
// Every protection the vendored provider enforces is mirrored exactly:
// the handle is pinned to the credential's origin at shape time, every
// request is re-checked against that origin (a cross-origin target is
// refused), and every outbound request forces `redirect: "manual"` so a
// 3xx never lets a server redirect the secret to a foreign host.

import type {
  CredentialProvider,
  CredentialShapeContext,
  HttpMediatedCredential,
} from "@intx/types";

/**
 * The minimal call signature the shaped handle needs from `fetch`,
 * matching `@intx/harness`'s own `FetchLike` so a caller can inject a stub
 * in tests without pulling the full `fetch` type's extra members.
 */
export type FetchLike = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

export interface HeaderCredentialProviderOptions {
  /** Provider plugin key a `credential` row's `plugin` column names. */
  key: string;
  /** Header name the secret is sent in. */
  header: string;
  /**
   * Optional prefix joined to the secret with a single space (e.g.
   * `"Bearer"` yields `Bearer <secret>`). Omit to send the secret verbatim.
   */
  prefix?: string;
  /**
   * The `fetch` the shaped handle delegates to once the request is
   * origin-checked and the header is injected. Defaults to the global
   * `fetch`; injectable so origin-pinning can be exercised without a
   * network.
   */
  fetch?: FetchLike;
}

/**
 * Build a header-shaped `CredentialProvider`: an `HttpMediatedCredential`
 * whose `fetch` sends the secret (optionally prefixed) in the configured
 * header. Register it alongside `@intx/harness`'s
 * `builtinCredentialProviders()` in a `CredentialProviderRegistry` and
 * point a provider row's `plugin` column at `opts.key` to opt that
 * credential's bindings into this header shape.
 */
export function createHeaderCredentialProvider(
  opts: HeaderCredentialProviderOptions,
): CredentialProvider {
  const fetchImpl: FetchLike = opts.fetch ?? globalThis.fetch;
  const { key, header, prefix } = opts;

  return {
    key,
    shape(context: CredentialShapeContext): HttpMediatedCredential {
      const pinnedOrigin = new URL(context.origin).origin;

      return {
        kind: "http",
        async fetch(
          input: string | URL | Request,
          init?: RequestInit,
        ): Promise<Response> {
          const target = resolveTargetUrl(input, pinnedOrigin);
          if (target.origin !== pinnedOrigin) {
            throw new Error(
              `${key} credential is pinned to ${pinnedOrigin}; refusing cross-origin request to ${target.origin}`,
            );
          }

          // Read the secret fresh on every call so a rotation of the
          // underlying material cell reaches this handle without a rebuild.
          const { secret } = context.readCurrentMaterial();
          const value = prefix !== undefined ? `${prefix} ${secret}` : secret;

          if (input instanceof Request) {
            const headers = new Headers(input.headers);
            headers.set(header, value);
            return fetchImpl(
              new Request(input, { headers, redirect: "manual" }),
            );
          }

          const headers = new Headers(init?.headers);
          headers.set(header, value);
          return fetchImpl(target, { ...init, headers, redirect: "manual" });
        },
        dispose(): void {
          // A header http handle allocates no resources; nothing to release.
        },
      };
    },
  };
}

/**
 * Resolve the URL a request targets, matching `@intx/harness`'s own
 * `resolveTargetUrl`: a relative string resolves against the pinned
 * origin, an absolute string or URL keeps its own origin (refused above if
 * it differs), and a `Request` already carries an absolute URL.
 */
function resolveTargetUrl(
  input: string | URL | Request,
  pinnedOrigin: string,
): URL {
  if (typeof input === "string") {
    return new URL(input, pinnedOrigin);
  }
  if (input instanceof URL) {
    return input;
  }
  return new URL(input.url);
}
