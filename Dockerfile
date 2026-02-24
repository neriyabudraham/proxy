# Build client
FROM node:20-alpine AS client-builder
WORKDIR /app/client
COPY client/package*.json ./
RUN npm install
COPY client/ ./
RUN npm run build

# Server
FROM node:20-alpine
WORKDIR /app

COPY server/package*.json ./
RUN npm install

COPY server/ ./
COPY --from=client-builder /app/client/dist ./public

RUN mkdir -p /app/data

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["node", "src/index.js"]
