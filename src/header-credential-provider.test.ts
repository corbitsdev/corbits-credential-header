import { expect, test } from "bun:test";

import { xApiKeyCredentialProvider, X_API_KEY_PROVIDER_KEY } from "./presets";
import {
  rawAuthorizationCredentialProvider,
  RAW_AUTHORIZATION_PROVIDER_KEY,
} from "./presets";
import { createHeaderCredentialProvider } from "./header-credential-provider";

const ORIGIN = "https://api.exa.ai";

function materialSource(secret: string): { current: string } {
  return { current: secret };
}

test("x-api-key preset key is http-x-api-key", () => {
  expect(xApiKeyCredentialProvider().key).toBe(X_API_KEY_PROVIDER_KEY);
});

test("raw-authorization preset key is http-raw-authorization", () => {
  expect(rawAuthorizationCredentialProvider().key).toBe(
    RAW_AUTHORIZATION_PROVIDER_KEY,
  );
});

test("sends the secret in x-api-key, not authorization", async () => {
  const captured: { apiKey: string | null; auth: string | null } = {
    apiKey: null,
    auth: null,
  };
  const provider = xApiKeyCredentialProvider({
    fetch: async (_input, init) => {
      const headers = new Headers(init?.headers);
      captured.apiKey = headers.get("x-api-key");
      captured.auth = headers.get("authorization");
      return new Response("{}", { status: 200 });
    },
  });
  const mediated = provider.shape({
    origin: ORIGIN,
    readCurrentMaterial: () => ({ secret: "exa_real_key" }),
  });

  await mediated.fetch(`${ORIGIN}/search`);

  expect(captured.apiKey).toBe("exa_real_key");
  expect(captured.auth).toBeNull();
});

test("sends the raw secret in authorization, with no Bearer prefix", async () => {
  const captured: { auth: string | null } = { auth: null };
  const provider = rawAuthorizationCredentialProvider({
    fetch: async (_input, init) => {
      captured.auth = new Headers(init?.headers).get("authorization");
      return new Response("{}", { status: 200 });
    },
  });
  const mediated = provider.shape({
    origin: "https://api.linear.app",
    readCurrentMaterial: () => ({ secret: "lin_api_key_real" }),
  });

  await mediated.fetch("https://api.linear.app/graphql");

  expect(captured.auth).toBe("lin_api_key_real");
  expect(captured.auth).not.toBe("Bearer lin_api_key_real");
});

test("joins a prefix to the secret with a single space", async () => {
  const captured: { auth: string | null } = { auth: null };
  const provider = createHeaderCredentialProvider({
    key: "http",
    header: "authorization",
    prefix: "Bearer",
    fetch: async (_input, init) => {
      captured.auth = new Headers(init?.headers).get("authorization");
      return new Response("{}", { status: 200 });
    },
  });
  const mediated = provider.shape({
    origin: ORIGIN,
    readCurrentMaterial: () => ({ secret: "tok-123" }),
  });

  await mediated.fetch(`${ORIGIN}/search`);

  expect(captured.auth).toBe("Bearer tok-123");
});

test("re-reads the material source per call, reflecting a rotation", async () => {
  const apiKeys: string[] = [];
  const material = materialSource("original-key");
  const provider = xApiKeyCredentialProvider({
    fetch: async (_input, init) => {
      apiKeys.push(new Headers(init?.headers).get("x-api-key") ?? "");
      return new Response("{}", { status: 200 });
    },
  });
  const mediated = provider.shape({
    origin: ORIGIN,
    readCurrentMaterial: () => ({ secret: material.current }),
  });

  await mediated.fetch(`${ORIGIN}/search`);
  material.current = "rotated-key";
  await mediated.fetch(`${ORIGIN}/search`);

  expect(apiKeys).toEqual(["original-key", "rotated-key"]);
});

test("refuses a cross-origin request rather than leaking the secret off the pinned origin", async () => {
  const provider = xApiKeyCredentialProvider({
    fetch: async () => new Response("{}", { status: 200 }),
  });
  const mediated = provider.shape({
    origin: ORIGIN,
    readCurrentMaterial: () => ({ secret: "exa_real_key" }),
  });

  await expect(
    mediated.fetch("https://evil.example.com/search"),
  ).rejects.toThrow(/refusing cross-origin request/);
});

test("forces redirect: manual so a same-origin 3xx never auto-follows off the handle", async () => {
  const captured: { redirect: string | undefined } = { redirect: undefined };
  const provider = xApiKeyCredentialProvider({
    fetch: async (_input, init) => {
      captured.redirect = init?.redirect;
      return new Response("{}", { status: 200 });
    },
  });
  const mediated = provider.shape({
    origin: ORIGIN,
    readCurrentMaterial: () => ({ secret: "exa_real_key" }),
  });

  await mediated.fetch(`${ORIGIN}/search`);

  expect(captured.redirect).toBe("manual");
});

test("also mediates a Request input, preserving its own headers", async () => {
  const captured: { apiKey: string | null } = { apiKey: null };
  const provider = xApiKeyCredentialProvider({
    fetch: async (request) => {
      if (request instanceof Request) {
        captured.apiKey = request.headers.get("x-api-key");
      }
      return new Response("{}", { status: 200 });
    },
  });
  const mediated = provider.shape({
    origin: ORIGIN,
    readCurrentMaterial: () => ({ secret: "exa_real_key" }),
  });

  await mediated.fetch(new Request(`${ORIGIN}/search`, { method: "POST" }));

  expect(captured.apiKey).toBe("exa_real_key");
});
