import logger from '../config/logger';
import prisma from '../config/prisma';
import { getErrorMessage } from '../utils/errors';
import { parseSalaryText } from '../utils/salary';

const BATCH = 500;

/**
 * Jobs posted before pay was stored as numbers only have text ("GHS 3,000 - 4,500 a month"). This reads
 * what it can, in batches, and marks every job it has looked at (salaryParsedAt) so it never looks twice.
 * Text it cannot be sure about (dollars, hourly pay, "negotiable") is left without numbers; the text is
 * untouched either way. It runs at start-up and in the daily sweep, because production applies schema
 * changes without data migrations.
 */
export const backfillJobSalaries = async (now: Date = new Date()) => {
  let checked = 0;
  let filled = 0;

  for (;;) {
    const jobs = await prisma.job.findMany({
      where: { salaryParsedAt: null },
      select: { id: true, salary: true, salaryMin: true, salaryMax: true },
      take: BATCH,
    });
    if (jobs.length === 0) break;

    for (const job of jobs) {
      // Numbers someone already set are never overwritten.
      const hasNumbers = job.salaryMin !== null || job.salaryMax !== null;
      const parsed = hasNumbers ? null : parseSalaryText(job.salary);

      await prisma.job.update({
        where: { id: job.id },
        data: {
          salaryParsedAt: now,
          ...(parsed ? { salaryMin: parsed.min, salaryMax: parsed.max } : {}),
        },
      });
      checked += 1;
      if (parsed) filled += 1;
    }

    if (jobs.length < BATCH) break;
  }

  return { checked, filled };
};

export const backfillJobSalariesSafely = async () => {
  try {
    const result = await backfillJobSalaries();
    if (result.checked > 0) logger.info('job_salary_backfill', result);
  } catch (error) {
    logger.error('job_salary_backfill_failed', { error: getErrorMessage(error) });
  }
};
