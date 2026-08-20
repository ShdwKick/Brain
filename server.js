#!/usr/bin/env node
"use strict";
/**
 * Статика тренажёра «Пораскинем мозгами?»: index.html и assets/, без бэкенда —
 * на этой странице нет ни авторизации, ни API, ни сохранения прогресса (см.
 * Design/README.md). Сервер нужен только чтобы отдавать файлы за общим nginx
 * на 443, тем же способом, что и у остальных сервисов: Watchtower тянет
 * образ, nginx проксирует на localhost:PORT (см. deploy/nginx-brain-443.conf).
 */
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const HOST = process.env.HOST || "0.0.0.0";
const PORT = Number(process.env.PORT) || 8795;
const ROOT = __dirname;

// sw.js обязан лежать в корне и отдаваться с корня: scope service worker'а по
// умолчанию — каталог, откуда он загружен, а офлайн нужен всей странице ("/"),
// не только assets/. favicon.ico — тоже корневой: браузеры и боты запрашивают
// его по умолчанию, игнорируя <link rel="icon"> в <head>. Свой белый список,
// как ROOT_VERIFICATION_FILES у Home.
const ROOT_ASSETS = ["sw.js", "favicon.ico"];

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".webmanifest": "application/manifest+json; charset=utf-8",
};

const server = http.createServer((req, res) => {
  // HEAD нужен мониторингу и "curl -I" — по HTTP-спеке сервер, отвечающий на
  // GET, обязан осмысленно отвечать и на HEAD, а не 405.
  const isHead = req.method === "HEAD";
  if (req.method !== "GET" && !isHead) {
    res.writeHead(405, { "Content-Type": "text/plain; charset=utf-8" }).end("Method Not Allowed");
    return;
  }

  const pathname = decodeURIComponent(new URL(req.url, "http://localhost").pathname);

  // Белый список вместо проверки на "../": наружу отдаём только index.html и
  // содержимое assets/ — этого достаточно для всей страницы (упражнения
  // переключаются на клиенте через #-роутер, до сервера хэш не долетает).
  const rel = pathname === "/" ? "index.html" : pathname.replace(/^\//, "");
  if (rel !== "index.html" && !rel.startsWith("assets/") && !ROOT_ASSETS.includes(rel)) {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" }).end("Not Found");
    return;
  }
  const filePath = path.join(ROOT, rel);

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" }).end("Not Found");
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    // index.html и sw.js — всегда свежие: на первом завязана вся страница,
    // второй браузер обязан перепроверять при каждой навигации, иначе
    // обновления тренажёра просто не долетят до уже установленного PWA.
    const noCache = ext === ".html" || rel === "sw.js";
    res.writeHead(200, {
      "Content-Type": TYPES[ext] || "application/octet-stream",
      // Файлы в assets/ не хэшируются по содержимому, поэтому кэшируем
      // ненадолго — разгружает сервер, но не держит старую версию сутками.
      "Cache-Control": noCache ? "no-cache" : "public, max-age=300",
    });
    res.end(isHead ? undefined : data);
  });
});

server.listen(PORT, HOST, () => {
  console.log(`Пораскинем мозгами? слушает http://${HOST}:${PORT}`);
});
