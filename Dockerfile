# ---- Build Stage ----
FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# ---- Production Stage ----
FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --production

COPY --from=builder /app/dist ./dist
COPY server.ts ./
COPY tsconfig.json ./

EXPOSE 3000

ENV NODE_ENV=production
CMD ["npx", "tsx", "server.ts"]
