// Error reporting must start before anything else loads.
import './instrument';
import { createServer } from 'http';
import app from './app';
import env from './config/env';
import logger from './config/logger';
import prisma from './config/prisma';
import { initSocket } from './services/socketService';
import { processPayout } from './controllers/agreementController';
import { getErrorMessage } from './utils/errors';
import { JOB_SWEEP_INTERVAL_MS, runJobLifecycleSweepSafely } from './services/jobLifecycleService';
import { runApplicationRemindersSafely } from './services/applicationReminderService';
import { backfillJobSalariesSafely } from './services/salaryBackfillService';
import { runBillingSweepSafely } from './services/billingService';
import { runCandidateAlertsSafely } from './services/cvDatabaseService';

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
         payoutAttemptedAt: null, // Idempotency: skip already-attempted payouts
         completedAt: {
           lte: new Date(Date.now() - env.payoutHoldDurationHours * 60 * 60 * 1000),
         }
       },
       select: { id: true, milestoneId: true }
     });

     if (maturePayments.length > 0) {
       logger.info('payout_worker_processing', { count: maturePayments.length });
       for (const payment of maturePayments) {
         if (payment.milestoneId) {
           // Mark as attempted before processing to prevent double payouts on crash/restart
           await prisma.payment.update({
             where: { id: payment.id },
             data: { payoutAttemptedAt: new Date() },
           });
           await processPayout(payment.milestoneId).catch(err => 
              logger.error('payout_worker_failed_single', { milestoneId: payment.milestoneId, error: err.message })
           );
         }
       }
     }
  } catch (error) {
    logger.error('payout_worker_error', { error: getErrorMessage(error) });
  }
}, payoutPollIntervalMs);

// --- Task Scheduling: job lifecycle (expire jobs past their closing date, warn employers 3 days before) ---
// Runs once a day, and once shortly after every start so a restart never skips a day. It is idempotent.
// The same daily run also reminds employers about applications left in New for 14 days.
const runDailySweeps = async () => {
  await runJobLifecycleSweepSafely();
  await runApplicationRemindersSafely();
  // Reads numbers out of older jobs' pay text. Finishes once, then finds nothing to do.
  await backfillJobSalariesSafely();
  // Renewal reminders three days ahead, and ends plans that were not renewed.
  await runBillingSweepSafely();
  // Email alerts for saved CV database searches that have new matches.
  await runCandidateAlertsSafely();
};
const jobSweepFirstRun = setTimeout(() => void runDailySweeps(), 60 * 1000);
const jobSweepTask = setInterval(() => void runDailySweeps(), JOB_SWEEP_INTERVAL_MS);

let isShuttingDown = false;

const shutdown = async (signal: string) => {
  if (isShuttingDown) return;
  isShuttingDown = true;

  clearInterval(payoutTask);
  clearTimeout(jobSweepFirstRun);
  clearInterval(jobSweepTask);
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
        error: disconnectError instanceof Error ? getErrorMessage(disconnectError) : String(disconnectError),
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
