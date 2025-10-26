FROM node:20-bullseye-slim
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
RUN npm i -g npm@10.8.2
WORKDIR /app

COPY services/orders/package.json ./
RUN npm i --no-audit --no-fund

COPY prisma ./prisma
RUN npx prisma generate --schema=./prisma/schema.prisma

COPY services/orders/server.js ./

EXPOSE 4003
CMD ["npm","start"]
