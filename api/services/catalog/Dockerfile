FROM node:20-bullseye-slim
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app

# Install deps using lockfile (required by npm ci)
COPY services/catalog/package.json ./
RUN npm i --no-audit --no-fund

# Prisma schema + client
COPY prisma ./prisma
RUN npx prisma generate --schema=./prisma/schema.prisma

# Service source
COPY services/catalog/server.js ./

EXPOSE 4002
CMD ["npm","start"]
