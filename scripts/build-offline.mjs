import { readdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
const root = path.resolve("dist/client");
async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  return (
    await Promise.all(
      entries.map((entry) =>
        entry.isDirectory()
          ? walk(path.join(dir, entry.name))
          : path.join(dir, entry.name),
      ),
    )
  ).flat();
}
const files = (await walk(root))
  .filter((file) => !file.endsWith("sw.js"))
  .sort();
const hash = createHash("sha256");
for (const file of files) hash.update(await readFile(file));
const name = `habbits-atom-${hash.digest("hex").slice(0, 12)}`;
const assets = files.map((file) =>
  path.relative(root, file).replaceAll("\\", "/"),
);
await writeFile(
  path.join(root, "sw.js"),
  `
const CACHE = ${JSON.stringify(name)};
const FILES = ${JSON.stringify(assets)};
const base = self.registration.scope;
const urls = FILES.map(file => new URL(file, base).href);
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(urls)));
});
// No skipWaiting: an update activates after existing app tabs close.
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) {
      if (key.startsWith('habbits-atom-') && key !== CACHE) await caches.delete(key);
    }
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET' || !request.url.startsWith(base)) return;
  if (request.mode === 'navigate') {
    // Serve HTML and hashed assets from the same installed version.
    // This also avoids waiting for a failing network before opening the app.
    event.respondWith((async () => {
      const cache = await caches.open(CACHE);
      return (await cache.match(new URL('index.html', base).href)) || fetch(request);
    })());
  } else if (urls.includes(request.url)) {
    // Vite/static hosts may add Vary: Origin. Module requests carry an Origin
    // header while precache requests do not. These are public same-origin,
    // versioned assets, so the cached bytes are independent of that header.
    event.respondWith(caches.open(CACHE).then(async cache => (await cache.match(request, { ignoreVary: true })) || fetch(request)));
  }
});
`,
);
console.log(`Offline shell: ${assets.length} local assets, ${name}`);
