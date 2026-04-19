FROM node:22-slim AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --production=false
COPY tsconfig.json ./
COPY src/ ./src/
RUN npx tsc

FROM node:22-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --production && npm cache clean --force
COPY --from=builder /app/dist/ ./dist/
COPY src/fixtures/patients/ ./dist/fixtures/patients/
ENV NODE_ENV=production
ENV PORT=3333
ENV MCP_MODE=fixture
EXPOSE 3333
CMD ["node", "dist/index.js"]
