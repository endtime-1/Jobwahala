import { PrismaClient } from '@prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import path from 'path';
import env from './env';
import logger from './logger';

const projectRoot = path.resolve(__dirname, '../..');
const isFileDatabase = env.databaseUrl.startsWith('file:');

let prisma: any;

if (isFileDatabase) {
  prisma = new PrismaClient({
    adapter: new PrismaBetterSqlite3({
      url: path.resolve(projectRoot, env.databaseUrl.slice('file:'.length)),
    }),
  } as any);
} else {
  const pool = new Pool({ connectionString: env.databaseUrl });
  const adapter = new PrismaPg(pool);
  prisma = new PrismaClient({ adapter } as any);
}

if (env.isProduction && isFileDatabase) {
  logger.warn('sqlite_single_instance_warning', {
    message: 'SQLite is configured for production. Use a single instance or migrate to PostgreSQL before scaling.',
  });
}

export default prisma;
