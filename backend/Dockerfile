FROM node:20-alpine

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

ENV NODE_ENV=production
EXPOSE 5000

CMD ["sh", "-c", "npm run prisma:migrate:deploy:postgres && npm run start"]
