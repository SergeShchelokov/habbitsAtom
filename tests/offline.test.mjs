import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

test("production service worker precaches complete shell and serves it when offline", async () => {
  const script = await readFile(
    new URL("../dist/client/sw.js", import.meta.url),
    "utf8",
  );
  const handlers = {};
  const store = new Map();
  let cachedUrls;
  const cache = {
    addAll: async (urls) => {
      cachedUrls = urls;
      for (const url of urls)
        store.set(url, {
          url,
          body: url.endsWith("index.html") ? "offline-shell" : "asset",
        });
    },
    // Simulate Vary: Origin: module requests differ from precache requests.
    match: async (req, options) => {
      if (typeof req === "string") return store.get(req);
      return options?.ignoreVary ? store.get(req.url) : undefined;
    },
  };
  let claimed = false;
  const context = {
    self: {
      registration: { scope: "https://example.test/app/" },
      addEventListener: (name, handler) => {
        handlers[name] = handler;
      },
      clients: {
        claim: async () => {
          claimed = true;
        },
      },
    },
    caches: {
      open: async () => cache,
      keys: async () => [],
      delete: async () => true,
    },
    URL,
    Response,
    fetch: async () => {
      throw new Error("offline");
    },
  };
  vm.runInNewContext(script, context);
  let pending;
  handlers.install({
    waitUntil: (promise) => {
      pending = promise;
    },
  });
  await pending;
  assert.ok(cachedUrls.some((url) => url.endsWith("index.html")));
  assert.ok(cachedUrls.some((url) => /\.js$/.test(url)));
  assert.ok(cachedUrls.some((url) => /\.css$/.test(url)));
  assert.ok(cachedUrls.some((url) => /\.woff2$/.test(url)));
  assert.ok(cachedUrls.some((url) => url.endsWith("assets/brand.png")));
  assert.ok(
    cachedUrls.every((url) => url.startsWith("https://example.test/app/")),
  );
  handlers.activate({
    waitUntil: (promise) => {
      pending = promise;
    },
  });
  await pending;
  assert.equal(claimed, true);
  let response;
  handlers.fetch({
    request: {
      method: "GET",
      mode: "navigate",
      url: "https://example.test/app/",
    },
    respondWith: (promise) => {
      response = promise;
    },
  });
  assert.equal((await response).body, "offline-shell");
  response = undefined;
  const asset = cachedUrls.find((url) => /\.js$/.test(url));
  handlers.fetch({
    request: { method: "GET", mode: "cors", url: asset },
    respondWith: (promise) => {
      response = promise;
    },
  });
  assert.equal((await response).body, "asset");
  response = undefined;
  handlers.fetch({
    request: {
      method: "GET",
      mode: "cors",
      url: "https://database.supabase.co/rest/v1/habits",
    },
    respondWith: (promise) => {
      response = promise;
    },
  });
  assert.equal(response, undefined, "cloud requests must never be cached");
});
