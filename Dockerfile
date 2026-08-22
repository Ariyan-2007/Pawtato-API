# --- Build stage ---
FROM node:22-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# --- Runtime stage ---
FROM node:22-alpine AS runtime

ENV NODE_ENV=production
WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=build /app/dist ./dist

RUN mkdir -p uploads && addgroup -S pawtato && adduser -S pawtato -G pawtato \
  && chown -R pawtato:pawtato /app
USER pawtato

EXPOSE 5000

CMD ["node", "dist/main.js"]
