// Registered solely to satisfy Chromium's PWA installability criteria, which
// require a service worker with a fetch handler before `beforeinstallprompt`
// will fire. It deliberately caches NOTHING - the empty fetch listener lets
// every request fall straight through to the network, so there is no stale
// asset or cache-versioning risk. See CLAUDE.md's PWA note and
// src/utils/installPrompt.ts, which registers this file.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {});
