FROM node:22-alpine AS base
WORKDIR /usr/src/app

COPY package*.json ./
RUN npm ci --omit=dev --no-audit --no-fund

COPY src ./src

ENV NODE_ENV=production
USER node
EXPOSE 5000

CMD ["node", "src/server.js"]
