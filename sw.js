"use strict";
/* Service worker тренажёра: кэширует оболочку приложения, чтобы после
   первого визита всё работало офлайн — упражнения статические, сети им
   взять неоткуда, а хочется. Лежит в корне (не в assets/), иначе scope
   по умолчанию ограничился бы каталогом, откуда файл отдан, и не накрыл
   бы навигацию по "/". */

const CACHE = "brain-shell-v2";
const SHELL = [
  "/",
  "/index.html",
  "/assets/styles.css",
  "/assets/brand.css",
  "/assets/brand.js",
  "/assets/app.js",
  "/assets/progress.js",
  "/assets/favicon.svg",
  "/assets/manifest.webmanifest",
  "/assets/icons/icon-192.png",
  "/assets/icons/icon-512.png",
  "/assets/exercises/nback.js",
  "/assets/exercises/dualnback.js",
  "/assets/exercises/corsi.js",
  "/assets/exercises/pairs.js",
  "/assets/exercises/schulte.js",
  "/assets/exercises/stroop.js",
  "/assets/exercises/trail.js",
  "/assets/exercises/reaction.js",
  "/assets/exercises/rotation.js",
  "/assets/exercises/hanoi.js",
  "/assets/exercises/anagrams.js",
  "/assets/exercises/categories.js",
  "/assets/exercises/switching.js",
  "/assets/exercises/mathsprint.js",
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Кэш-первым для всего, что в оболочке; для навигации при офлайне — всегда
// отдаём закэшированный index.html (роутер сам разберёт путь на клиенте:
// адресная строка при этом остаётся /schulte и т.п., хотя тело ответа —
// закэшированный "/").
self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request)
        .then(res => {
          const copy = res.clone();
          caches.open(CACHE).then(cache => cache.put(event.request, copy));
          return res;
        })
        .catch(() => (event.request.mode === "navigate" ? caches.match("/index.html") : undefined));
    })
  );
});
