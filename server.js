#!/usr/bin/env node
"use strict";
/**
 * Статика тренажёра «Пораскинем мозгами?»: index.html и assets/, без бэкенда —
 * на этой странице нет ни авторизации, ни API, ни сохранения прогресса (см.
 * Design/README.md). Сервер нужен только чтобы отдавать файлы за общим nginx
 * на 443, тем же способом, что и у остальных сервисов: Watchtower тянет
 * образ, nginx проксирует на localhost:PORT (см. deploy/nginx-brain-443.conf).
 *
 * Роутинг — через History API (/schulte, /nback...), а не #-хэш: хэш вообще
 * не долетает до сервера, так что для Яндекса/Google весь сайт был бы одним
 * URL. Сервер не умеет ничего "исполнять" для конкретного маршрута — просто
 * знает список валидных путей (APP_ROUTES) и на каждый отдаёт тот же
 * index.html (дальше рисует роутер в assets/app.js), но с подставленными
 * <title>/description/canonical на этот путь (see seo-routes.js) — чтобы
 * первый байт ответа уже был правильным для ботов, которые JS не исполняют
 * (превью ссылок в Telegram/VK/WhatsApp), и чтобы Яндекс, даже не дожидаясь
 * рендеринга JS, видел разные заголовки на разных страницах.
 */
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const SEO = require("./seo-routes.js");

const HOST = process.env.HOST || "0.0.0.0";
const PORT = Number(process.env.PORT) || 8795;
const ROOT = __dirname;
const SITE_URL = "https://brain.burninghouse.ru";

// sw.js обязан лежать в корне и отдаваться с корня: scope service worker'а по
// умолчанию — каталог, откуда он загружен, а офлайн нужен всей странице ("/"),
// не только assets/. favicon.ico — тоже корневой: браузеры и боты запрашивают
// его по умолчанию, игнорируя <link rel="icon"> в <head>. robots.txt и
// sitemap.xml — тоже по конвенции именно из корня. Свой белый список, как
// ROOT_FILES у Home.
const ROOT_ASSETS = ["sw.js", "favicon.ico", "robots.txt", "sitemap.xml"];

// Валидные маршруты клиентского роутера (assets/app.js: EXERCISES.map(e=>e.id)
// плюс "stats" и хаб). Держим отдельным списком, а не импортируем из app.js:
// тот — ES-модуль для браузера, этот файл — CommonJS для Node, а список из
// 14 id меняется редко настолько, что раздельное поддержание дешевле, чем
// городить общий модуль на два формата ради этого.
const APP_ROUTES = new Set([
  "", "stats",
  "nback", "dualnback", "corsi", "pairs",
  "schulte", "stroop", "trail", "reaction",
  "rotation", "hanoi", "anagrams", "categories",
  "switching", "mathsprint",
]);

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
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
};

// Простая подмена по месту вместо шаблонизатора: страница одна, полей мало,
// а тексты в seo-routes.js — наши же, без пользовательского ввода, так что
// экранировать нечего. Функция-замена вместо строки — чтобы "$"-паттерны
// в тексте (если появятся) не трактовались replace()'ом как спецсимволы.
function injectSeo(html, routeKey) {
  const seo = SEO[routeKey];
  if (!seo) return html;
  const url = routeKey ? `${SITE_URL}/${routeKey}` : `${SITE_URL}/`;
  const robots = seo.robots || "index, follow";
  return html
    .replace(/<title>.*?<\/title>/, () => `<title>${seo.title}</title>`)
    .replace(/<meta name="robots" content="[^"]*">/, () => `<meta name="robots" content="${robots}">`)
    .replace(/<meta name="description" content="[^"]*">/, () => `<meta name="description" content="${seo.description}">`)
    .replace(/<link rel="canonical" href="[^"]*">/, () => `<link rel="canonical" href="${url}">`)
    .replace(/<meta property="og:url" content="[^"]*">/, () => `<meta property="og:url" content="${url}">`)
    .replace(/<meta property="og:title" content="[^"]*">/, () => `<meta property="og:title" content="${seo.title}">`)
    .replace(/<meta property="og:description" content="[^"]*">/, () => `<meta property="og:description" content="${seo.description}">`)
    .replace(/<meta name="twitter:title" content="[^"]*">/, () => `<meta name="twitter:title" content="${seo.title}">`)
    .replace(/<meta name="twitter:description" content="[^"]*">/, () => `<meta name="twitter:description" content="${seo.description}">`);
}

const server = http.createServer((req, res) => {
  // HEAD нужен мониторингу и "curl -I" — по HTTP-спеке сервер, отвечающий на
  // GET, обязан осмысленно отвечать и на HEAD, а не 405.
  const isHead = req.method === "HEAD";
  if (req.method !== "GET" && !isHead) {
    res.writeHead(405, { "Content-Type": "text/plain; charset=utf-8" }).end("Method Not Allowed");
    return;
  }

  const pathname = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
  const rel = pathname === "/" ? "" : pathname.replace(/^\/+/, "").replace(/\/+$/, "");
  // "/index.html" — то же самое, что "/": sw.js прямо запрашивает его по
  // этому пути в SHELL (см. sw.js), и должен получить 200, а не 404.
  const routeKey = rel === "index.html" ? "" : rel;

  // Белый список: index.html (сам "/" и любой маршрут роутера — см. APP_ROUTES
  // выше), содержимое assets/ и корневые файлы вроде sw.js/robots.txt. Никакой
  // проверки на "../" не нужно — всё остальное просто не проходит список.
  if (rel === "" || rel === "index.html" || APP_ROUTES.has(rel)) {
    fs.readFile(path.join(ROOT, "index.html"), "utf8", (err, html) => {
      if (err) { res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" }).end("Internal Error"); return; }
      const body = injectSeo(html, routeKey);
      res.writeHead(200, { "Content-Type": TYPES[".html"], "Cache-Control": "no-cache" });
      res.end(isHead ? undefined : body);
    });
    return;
  }
  if (!rel.startsWith("assets/") && !ROOT_ASSETS.includes(rel)) {
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
    // sw.js: браузер обязан перепроверять его при каждой навигации, иначе
    // обновления тренажёра просто не долетят до уже установленного PWA.
    const noCache = rel === "sw.js";
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
