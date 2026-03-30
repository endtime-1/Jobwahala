import { PrismaClient } from '@prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import path from 'path';
import env from './env';
import logger from './logger';

const projectRoot = path.resolve(__dirname, '../..');
const isFileDatabase = env.databaseUrl.startsWith('file:');

const prisma = isFileDatabase
  ? new PrismaClient({
      adapter: new PrismaBetterSqlite3({
        url: path.resolve(projectRoot, env.databaseUrl.slice('file:'.length)),
      }),
    } as any)
  : new PrismaClient({ datasourceUrl: env.databaseUrl } as any);

if (env.isProduction && isFileDatabase) {
  logger.warn('sqlite_single_instance_warning', {
    message: 'SQLite is configured for production. Use a single instance or migrate to PostgreSQL before scaling.',
  });
}

export default prisma;
