# ベースイメージはバージョンを固定する（latest はビルドのたびに Node のバージョンが変わり再現性がないため）
FROM public.ecr.aws/docker/library/node:22-slim AS build

WORKDIR /app

COPY package.json package-lock.json ./

RUN npm ci

COPY app.ts ./

RUN npm run bundle

FROM public.ecr.aws/docker/library/node:22-slim

ENV NODE_ENV=production

WORKDIR /app

COPY --from=build /app/dist/app.js ./

# コンテナは非 root で実行する（ポート 8080 なので特権不要）
USER node

EXPOSE 8080

CMD ["node", "app.js"]
