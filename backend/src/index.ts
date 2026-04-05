import { createServer } from 'http';
import app from './app';
import env from './config/env';
import logger from './config/logger';
import prisma from './config/prisma';
import { initSocket } from './services/socketService';
import { processPayout } from './controllers/agreementController';

const httpServer = createServer(app);
initSocket(httpServer);

const server = httpServer.listen(env.port, () => {
  logger.info('server_started', {
    port: env.port,
    environment: env.nodeEnv,
  });
});

server.requestTimeout = env.requestTimeoutMs;
server.headersTimeout = env.requestTimeoutMs + 1000;
server.keepAliveTimeout = 5000;

// --- Task Scheduling: Automated Payout Processor ---
// Runs every 15 minutes to find and process mature escrow payments (24h hold).
const payoutPollIntervalMs = 15 * 60 * 1000;
const payoutTask = setInterval(async () => {
  try {
     const maturePayments = await prisma.payment.findMany({
       where: {
         payoutStatus: 'PENDING',
         status: 'SUCCEEDED',
         completedAt: {
           lte: new Date(Date.now() - env.payoutHoldDurationHours * 60 * 60 * 1000),
         }
       },
       select: { milestoneId: true }
     });

     if (maturePayments.length > 0) {
       logger.info('payout_worker_processing', { count: maturePayments.length });
       for (const payment of maturePayments) {
         if (payment.milestoneId) {
           await processPayout(payment.milestoneId).catch(err => 
              logger.error('payout_worker_failed_single', { milestoneId: payment.milestoneId, error: err.message })
           );
         }
       }
     }
  } catch (error: any) {
    logger.error('payout_worker_error', { error: error.message });
  }
}, payoutPollIntervalMs);

let isShuttingDown = false;

const shutdown = async (signal: string) => {
  if (isShuttingDown) return;
  isShuttingDown = true;

  clearInterval(payoutTask);
  logger.info('shutdown_started', { signal });

  server.close(async (error) => {
    if (error) {
      logger.error('shutdown_server_close_failed', { signal, error: error.message });
      process.exit(1);
      return;
    }

    try {
      await prisma.$disconnect();
      logger.info('shutdown_completed', { signal });
      process.exit(0);
    } catch (disconnectError) {
      logger.error('shutdown_prisma_disconnect_failed', {
        signal,
        error: disconnectError instanceof Error ? disconnectError.message : String(disconnectError),
      });
      process.exit(1);
    }
  });

  setTimeout(() => {
    logger.error('shutdown_forced', { signal });
    process.exit(1);
  }, 10000).unref();
};

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));

process.on('unhandledRejection', (reason) => {
  logger.error('unhandled_rejection', {
    error: reason instanceof Error ? reason.message : String(reason),
  });
});

process.on('uncaughtException', (error) => {
  logger.error('uncaught_exception', { error: error.message });
  void shutdown('uncaughtException');
});
