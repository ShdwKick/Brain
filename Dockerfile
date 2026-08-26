FROM node:24-alpine

WORKDIR /app

# Зависимостей нет вовсе — как и у остальных сервисов BurningHouse. Сервер —
# один файл на встроенном http (+ встроенный node:sqlite для результатов
# друзей — см. server.js), страница в основном статическая, полноценного
# бэкенда с аккаунтами по-прежнему нет: вход берётся из auth.burninghouse.ru.
COPY server.js ./
COPY auth-client.js ./
COPY seo-routes.js ./
COPY index.html ./
COPY sw.js ./
COPY robots.txt ./
COPY sitemap.xml ./
COPY favicon.ico ./
COPY assets/ ./assets/

# Каталог для scores.db (результаты друзей). В контейнере примонтирован как
# volume — см. docker-compose.yml/.prod.yml. Гостевой прогресс сюда не
# попадает вовсе — он в localStorage браузера, не на сервере.
RUN mkdir -p /app/data && chown -R node:node /app

RUN set -e; \
    for f in server.js auth-client.js seo-routes.js index.html sw.js robots.txt sitemap.xml favicon.ico; do \
      test -f "$f" || { echo "В образе нет $f — проверьте COPY в Dockerfile"; exit 1; }; \
    done; \
    node --check server.js && node --check auth-client.js && node --check seo-routes.js

USER node

ENV HOST=0.0.0.0
ENV PORT=8795
ENV DATA_DIR=/app/data

EXPOSE 8795
VOLUME ["/app/data"]

CMD ["node", "server.js"]
