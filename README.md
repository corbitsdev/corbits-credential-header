# @corbits/credential-header

> [!IMPORTANT]
> This package moved to [`@corbits/credential-http`](https://github.com/corbitsdev/credential-http), which also covers MCP streamable HTTP. New code should use it. Plugin keys and header shapes are unchanged, so stored credential rows need no migration. One behavior changes: an empty secret now sends no header.
>
> | `@corbits/credential-header`                                       | `@corbits/credential-http`                        |
> | ------------------------------------------------------------------ | ------------------------------------------------- |
> | `xApiKeyCredentialProvider(opts?)`                                 | `createXApiKeyCredentialProvider(opts?)`          |
> | `rawAuthorizationCredentialProvider(opts?)`                        | `createRawAuthorizationCredentialProvider(opts?)` |
> | `createHeaderCredentialProvider({ key, header, prefix?, fetch? })` | unchanged, plus `extraOrigins?`                   |
> | `HeaderPresetOptions`                                              | `CredentialPresetOptions`                         |
> | `X_API_KEY_PROVIDER_KEY`, `RAW_AUTHORIZATION_PROVIDER_KEY`         | unchanged                                         |
> | `HeaderCredentialProviderOptions`                                  | unchanged                                         |
> | `FetchLike`                                                        | import from `@intx/harness`                       |

A header-shaped `CredentialProvider` for Interchange: `@intx/harness`'s
vendored `createHttpCredentialProvider` always sends
`authorization: Bearer <secret>`, which doesn't fit an API that expects the
raw key with no prefix, or a different header entirely.
`createHeaderCredentialProvider` covers both by taking the header name and
an optional prefix as configuration; two presets cover the common cases.

This package is a library only for now: registering a provider into the
Interchange sidecar's `CredentialProviderRegistry` is blocked on an
upstream hook, so a host wires it in by hand until that lands.

## Install

```sh
bun add @corbits/credential-header
```

## Usage

```ts
import {
  builtinCredentialProviders,
  createCredentialProviderRegistry,
} from "@intx/harness";
import {
  xApiKeyCredentialProvider,
  rawAuthorizationCredentialProvider,
} from "@corbits/credential-header";

const providers = createCredentialProviderRegistry([
  ...builtinCredentialProviders(),
  xApiKeyCredentialProvider(),
  rawAuthorizationCredentialProvider(),
]);
```

A tenant's credential's `provider` row sets `plugin` to the preset's key
(`"http-x-api-key"` or `"http-raw-authorization"`) to opt its bindings into
that header shape instead of the vendored `"http"` (Bearer) default.

For any other header shape, call the factory directly:

```ts
import { createHeaderCredentialProvider } from "@corbits/credential-header";

const provider = createHeaderCredentialProvider({
  key: "http-x-manus-api-key",
  header: "x-manus-api-key",
});
```

## API

- `createHeaderCredentialProvider({ key, header, prefix?, fetch? })` — the
  general factory. Returns a `CredentialProvider` whose `kind` is `"http"`
  and whose shaped handle sets `header` to `prefix ? \`${prefix} ${secret}\`
  : secret`, refuses cross-origin targets, and never follows redirects.
- `xApiKeyCredentialProvider(opts?)` — preset: key `"http-x-api-key"`,
  header `x-api-key`.
- `rawAuthorizationCredentialProvider(opts?)` — preset: key
  `"http-raw-authorization"`, header `authorization`, no prefix.

Every protection `@intx/harness`'s vendored `http` provider enforces is
mirrored exactly: the handle is pinned to the credential's origin at shape
time, every request is re-checked against that origin, and every outbound
request forces `redirect: "manual"`.

## License

LGPL-2.1-only.
