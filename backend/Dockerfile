FROM node:24-alpine AS base
WORKDIR /usr/src/app

COPY backend/package*.json ./
RUN npm install --omit=dev --no-audit --no-fund

COPY backend/src ./src

ENV NODE_ENV=production
USER node
EXPOSE 5000

CMD ["node", "src/server.js"]
