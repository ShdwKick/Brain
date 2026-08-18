FROM node:24-alpine

WORKDIR /app

# Зависимостей нет вовсе — как и у остальных сервисов BurningHouse. Сервер —
# один файл на встроенном http, страница статическая, бэкенда нет.
COPY server.js ./
COPY index.html ./
COPY sw.js ./
COPY assets/ ./assets/

RUN set -e; \
    for f in server.js index.html sw.js; do \
      test -f "$f" || { echo "В образе нет $f — проверьте COPY в Dockerfile"; exit 1; }; \
    done; \
    node --check server.js

USER node

ENV HOST=0.0.0.0
ENV PORT=8795

EXPOSE 8795

CMD ["node", "server.js"]
