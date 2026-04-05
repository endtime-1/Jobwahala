# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY prisma ./prisma
COPY prisma.config.ts ./prisma.config.ts
COPY prisma.postgresql.config.ts ./prisma.postgresql.config.ts
RUN DATABASE_URL="postgresql://dummy:dummy@localhost/dummy" npm run prisma:generate:postgres

COPY tsconfig.json ./
COPY src ./src
COPY scripts ./scripts
RUN npm run build

# Stage 2: Run
FROM node:20-alpine

WORKDIR /app

COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.postgresql.config.ts ./prisma.postgresql.config.ts

ENV NODE_ENV=production
EXPOSE 5000

# Healthcheck to monitor API and database connectivity
HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:5000/ready').then((response)=>process.exit(response.ok?0:1)).catch(()=>process.exit(1))"]

CMD ["sh", "-c", "npm run prisma:migrate:deploy:postgres && npm run start"]
