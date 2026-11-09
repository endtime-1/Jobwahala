import prisma from '../config/prisma';
import logger from '../config/logger';
import { recordAdminAction } from '../utils/adminAudit';
import { getErrorMessage } from '../utils/errors';
import { normaliseWebsite, parseDateText, readJobCsv, titleKey, type ImportRow } from '../utils/jobImport';
import { createManagedCompany } from './acquisitionService';
import { notifyJobAlerts } from './jobAlertService';

type Admin = { id: string; email: string };

export class ImportError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export type ImportInput = {
  csv: string;
  /** Either an existing company (from the Growth section) by id, or the details of a company to create. */
  company: { id?: string; name?: string; website?: string; email?: string; phone?: string };
  defaultType: string;
  defaultClosingDate: string;
  /** Only report what would happen. */
  dryRun: boolean;
};

export type ImportLine = {
  line: number;
  title: string;
  status: 'created' | 'would_create' | 'skipped' | 'invalid';
  reason?: string;
  id?: string;
  path?: string;
};

export type ImportResult = {
  company: { id: string | null; name: string; exists: boolean };
  dryRun: boolean;
  counts: { created: number; skipped: number; invalid: number };
  lines: ImportLine[];
};

const emailLooksRight = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

/**
 * Imports jobs from a CSV on behalf of a company. The company is created if it does not exist yet (as an unclaimed company the owner
 * can take over later). Rows whose title already exists for that company are skipped, so running the same file twice is safe.
 * Every job is shown as "posted by JobWahala on behalf of" the company, and the import is written to the admin action log.
 */
export const importJobs = async (admin: Admin, input: ImportInput, now = new Date()): Promise<ImportResult> => {
  const closesAt = parseDateText(input.defaultClosingDate);
  if (!closesAt) throw new ImportError(400, 'Choose the closing date to use when a row has none.');
  if (closesAt <= now) throw new ImportError(400, 'The default closing date must be in the future.');

  const rows: ImportRow[] = readJobCsv(input.csv, { type: input.defaultType.trim() || 'Full-time', closesAt }, now);
  if (rows.length === 0) throw new ImportError(400, 'The file has no job rows. The first row must be the column names.');
  if (rows.length > 200) throw new ImportError(400, 'Import at most 200 jobs at a time.');

  // A company picked in the Growth section is used as it is: its name decides, never the file, so no second copy is made.
  const picked = input.company.id
    ? await prisma.employerProfile.findUnique({ where: { userId: input.company.id }, select: { userId: true, companyName: true } })
    : null;
  if (input.company.id && !picked) throw new ImportError(404, 'That company no longer exists.');

  const csvCompanies = [...new Set(rows.map((row) => row.company).filter(Boolean))];
  const companyName = picked?.companyName ?? (input.company.name?.trim() || (csvCompanies.length === 1 ? csvCompanies[0] : ''));
  if (!companyName) throw new ImportError(400, 'Enter the company name (the file names more than one company, or none).');
  const email = input.company.email?.trim() || '';
  if (email && !emailLooksRight(email)) throw new ImportError(400, 'The company email does not look right.');

  const profiles = picked ? [picked] : await prisma.employerProfile.findMany({ select: { userId: true, companyName: true }, take: 10000 });
  const existing = profiles.find((profile) => titleKey(profile.companyName) === titleKey(companyName));
  const taken = new Set<string>();
  if (existing) {
    const jobs = await prisma.job.findMany({ where: { employerId: existing.userId }, select: { title: true } });
    for (const job of jobs) taken.add(titleKey(job.title));
  }

  const plan = rows.map((row): { row: ImportRow; status: ImportLine['status']; reason?: string } => {
    if (row.problems.length > 0) return { row, status: 'invalid', reason: row.problems.join('. ') };
    const key = titleKey(row.title);
    if (taken.has(key)) return { row, status: 'skipped', reason: 'A job with this title already exists for this company' };
    taken.add(key);
    return { row, status: input.dryRun ? 'would_create' : 'created' };
  });

  const toCreate = plan.filter((entry) => entry.status === 'created' || entry.status === 'would_create');
  const counts = {
    created: toCreate.length,
    skipped: plan.filter((entry) => entry.status === 'skipped').length,
    invalid: plan.filter((entry) => entry.status === 'invalid').length,
  };
  const toLine = (entry: (typeof plan)[number], id?: string): ImportLine => ({
    line: entry.row.line,
    title: entry.row.title,
    status: entry.status,
    ...(entry.reason ? { reason: entry.reason } : {}),
    ...(id ? { id, path: `/jobs/${id}` } : {}),
  });

  if (input.dryRun) {
    return { company: { id: existing?.userId ?? null, name: existing?.companyName ?? companyName, exists: Boolean(existing) }, dryRun: true, counts, lines: plan.map((entry) => toLine(entry)) };
  }

  // The company, created once if it is new.
  let companyId = existing?.userId;
  if (!companyId) {
    const created = await createManagedCompany(admin, {
      companyName,
      website: normaliseWebsite(input.company.website),
      contactPhone: input.company.phone?.trim() || null,
    });
    companyId = created.id;
    if (email) await prisma.employerProfile.update({ where: { userId: companyId }, data: { contactEmail: email } });
  }

  const ids = new Map<number, string>();
  const createdJobs = await prisma.$transaction(async (tx) => {
    const made = [];
    for (const { row } of toCreate) {
      const job = await tx.job.create({
        data: {
          employerId: companyId!,
          postedByAdminId: admin.id,
          postedByAdminAt: now,
          title: row.title,
          description: row.description,
          location: row.location,
          type: row.type,
          salary: row.salary,
          salaryMin: row.salaryMin,
          salaryMax: row.salaryMax,
          salaryParsedAt: now,
          category: row.category,
          closesAt: row.closesAt,
          applyInstructions: row.applyInstructions,
        },
      });
      ids.set(row.line, job.id);
      made.push(job);
    }
    await recordAdminAction(tx, {
      admin,
      action: 'JOBS_IMPORTED',
      targetType: 'User',
      targetId: companyId!,
      metadata: { companyName, created: made.length, skipped: counts.skipped, invalid: counts.invalid, jobIds: made.map((job) => job.id) },
    });
    return made;
  });

  // Job alerts go out after the jobs are saved, and never hold up the import.
  for (const job of createdJobs) {
    notifyJobAlerts(job).catch((error) => logger.warn('import_alert_failed', { error: getErrorMessage(error) }));
  }

  return { company: { id: companyId, name: existing?.companyName ?? companyName, exists: Boolean(existing) }, dryRun: false, counts, lines: plan.map((entry) => toLine(entry, ids.get(entry.row.line))) };
};
