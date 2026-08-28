#!/usr/bin/env node
"use strict";
/**
 * Статика тренажёра «Пораскинем мозгами?»: index.html и assets/, плюс
 * маленький API для результатов друзей — остального бэкенда как не было, так
 * и нет (ни аккаунтов, ни паролей: всё это на общем auth.burninghouse.ru, см.
 * Auth/INTEGRATION.md). Сервер нужен, чтобы отдавать файлы за общим nginx на
 * 443, тем же способом, что и у остальных сервисов: Watchtower тянет образ,
 * nginx проксирует на localhost:PORT (см. deploy/nginx-brain-443.conf).
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
 *
 * Вход и друзья — НЕОБЯЗАТЕЛЬНЫ: гостевой режим (localStorage, см.
 * assets/progress.js) как был основным сценарием, так и остался. Если
 * AUTH_ISSUER не задан или сам auth недоступен, /api/config честно об этом
 * сообщает, а фронт просто не предлагает войти — сервер из-за этого не падает.
 */
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");
const SEO = require("./seo-routes.js");

const HOST = process.env.HOST || "0.0.0.0";
const PORT = Number(process.env.PORT) || 8795;
const ROOT = __dirname;
const SITE_URL = "https://brain.burninghouse.ru";
const DATA_DIR = process.env.DATA_DIR || path.join(ROOT, "data");

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
  "schulte", "stroop", "trail", "reaction", "flanker",
  "rotation", "hanoi", "maze", "anagrams", "categories",
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

// ---------- друзья: общий аккаунт BurningHouse ----------
// auth-client.js — копия из Auth/client/ (см. Auth/INTEGRATION.md), проверяет
// подпись access-токена локально, в auth на каждый запрос не ходит.
const AUTH_ISSUER = (process.env.AUTH_ISSUER || "https://auth.burninghouse.ru").replace(/\/+$/, "");
const AUTH_CLIENT_ID = process.env.AUTH_CLIENT_ID || "brain";
let auth = null;
try {
  auth = require("./auth-client")({
    issuer: AUTH_ISSUER,
    audience: AUTH_CLIENT_ID,
    jwksUrl: process.env.AUTH_JWKS_URL,
  });
  auth.warmup();
} catch (e) {
  console.error("auth-client не поднялся — вход и результаты друзей будут недоступны:", e.message);
}

// ---------- хранилище личных рекордов, синхронизированных с сервером ----------
// Только те, что человек сам решил показывать друзьям, залогинившись — гостевой
// прогресс в localStorage сюда не попадает вовсе (см. assets/progress.js).
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
const db = new DatabaseSync(path.join(DATA_DIR, "scores.db"));
db.exec("PRAGMA journal_mode = WAL");
db.exec(`
  CREATE TABLE IF NOT EXISTS scores (
    user_id    TEXT NOT NULL,
    key        TEXT NOT NULL,   -- то же, что badgeKey/record.key на фронте: "schulte:4", "nback:2", "reaction"...
    value      REAL NOT NULL,
    direction  TEXT NOT NULL,   -- "higher" | "lower" — храним при каждой записи, чтобы сервер сам знал, что лучше
    updated_at INTEGER NOT NULL,
    PRIMARY KEY (user_id, key)
  );
  CREATE INDEX IF NOT EXISTS idx_scores_user ON scores(user_id);
`);
const q = {
  get: db.prepare("SELECT value, direction FROM scores WHERE user_id = ? AND key = ?"),
  upsert: db.prepare(`
    INSERT INTO scores (user_id, key, value, direction, updated_at) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(user_id, key) DO UPDATE SET value = excluded.value, direction = excluded.direction, updated_at = excluded.updated_at
  `),
  listForUser: db.prepare("SELECT key, value FROM scores WHERE user_id = ?"),
};

/** Перезаписывает рекорд, только если новое значение действительно лучше — так
 * повторная отправка с устаревшего клиента (второе устройство, не видевшее
 * последний прогресс) не может откатить результат назад. */
function upsertIfBetter(userId, key, value, direction) {
  const row = q.get.get(userId, key);
  if (row && (direction === "higher" ? value <= row.value : value >= row.value)) return row.value;
  q.upsert.run(userId, key, value, direction, Date.now());
  return value;
}

async function fetchFriendsList(bearerToken) {
  const res = await fetch(`${AUTH_ISSUER}/api/friends`, {
    headers: { Authorization: `Bearer ${bearerToken}` },
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) throw new Error("GET /api/friends: HTTP " + res.status);
  return res.json();
}

function json(res, code, obj) {
  res.writeHead(code, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  res.end(JSON.stringify(obj));
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", c => { data += c; if (data.length > 8 * 1024) { reject(new Error("too large")); req.destroy(); } });
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

async function handleApi(req, res, pathname) {
  if (pathname === "/api/config") {
    if (req.method !== "GET") return json(res, 405, { error: "method_not_allowed" });
    // authBase: null — фронт понимает, что вход сейчас недоступен, и просто не
    // показывает кнопку «Войти», вместо того чтобы уводить в никуда.
    return json(res, 200, { authBase: auth ? AUTH_ISSUER : null, clientId: AUTH_CLIENT_ID });
  }

  if (pathname === "/api/scores") {
    if (req.method !== "POST") return json(res, 405, { error: "method_not_allowed" });
    if (!auth) return json(res, 503, { error: "auth_unavailable" });
    const user = await auth.userFromRequest(req);
    if (!user) return json(res, 401, { error: "unauthorized" });
    let body;
    try { body = JSON.parse((await readBody(req)) || "{}"); } catch { return json(res, 400, { error: "bad_request" }); }
    const key = String(body.key || "").slice(0, 64);
    const value = Number(body.value);
    const direction = body.direction === "higher" || body.direction === "lower" ? body.direction : null;
    if (!key || !Number.isFinite(value) || !direction) return json(res, 400, { error: "bad_request" });
    const stored = upsertIfBetter(user.id, key, value, direction);
    return json(res, 200, { ok: true, stored });
  }

  if (pathname === "/api/scores/friends") {
    if (req.method !== "GET") return json(res, 405, { error: "method_not_allowed" });
    if (!auth) return json(res, 503, { error: "auth_unavailable" });
    const bearerToken = auth.bearer(req);
    const user = await auth.userFromRequest(req);
    if (!user) return json(res, 401, { error: "unauthorized" });
    let list;
    try {
      list = ((await fetchFriendsList(bearerToken)).friends) || [];
    } catch (e) {
      console.error("Не удалось получить список друзей из auth:", e.message);
      return json(res, 502, { error: "friends_unavailable" });
    }
    const friends = list.map(f => {
      const scores = {};
      for (const row of q.listForUser.all(f.userId)) scores[row.key] = row.value;
      return { userId: f.userId, username: f.username, name: f.name, scores };
    });
    return json(res, 200, { friends });
  }

  return json(res, 404, { error: "not_found" });
}

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
  const pathname = decodeURIComponent(new URL(req.url, "http://localhost").pathname);

  if (pathname.startsWith("/api/")) {
    handleApi(req, res, pathname).catch(err => {
      console.error("Ошибка API:", err);
      if (!res.headersSent) json(res, 500, { error: "internal" });
    });
    return;
  }

  // HEAD нужен мониторингу и "curl -I" — по HTTP-спеке сервер, отвечающий на
  // GET, обязан осмысленно отвечать и на HEAD, а не 405.
  const isHead = req.method === "HEAD";
  if (req.method !== "GET" && !isHead) {
    res.writeHead(405, { "Content-Type": "text/plain; charset=utf-8" }).end("Method Not Allowed");
    return;
  }

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
