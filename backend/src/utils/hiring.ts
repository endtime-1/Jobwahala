/**
 * Hiring Service rules that need no database: statuses, the guarantee dates, money, and what each person is allowed to see.
 * Pure functions, so they are easy to test.
 */

export const DAY_MS = 86_400_000;

export const REQUEST_STATUSES = ['NEW', 'AGREED', 'SOURCING', 'SHORTLIST_SENT', 'INTERVIEWING', 'FILLED', 'CANCELLED'] as const;
export type RequestStatus = (typeof REQUEST_STATUSES)[number];
/** Not finished: still being worked on. */
export const OPEN_STATUSES: readonly string[] = ['NEW', 'AGREED', 'SOURCING', 'SHORTLIST_SENT', 'INTERVIEWING'];
/** Staff can find and add candidates in these. */
export const WORKING_STATUSES: readonly string[] = ['AGREED', 'SOURCING', 'SHORTLIST_SENT', 'INTERVIEWING'];

export const STATUS_LABEL: Record<string, string> = {
  NEW: 'New',
  AGREED: 'Agreed',
  SOURCING: 'Sourcing',
  SHORTLIST_SENT: 'Shortlist sent',
  INTERVIEWING: 'Interviewing',
  FILLED: 'Filled',
  CANCELLED: 'Cancelled',
};

export const CANDIDATE_STAGES = ['SOURCED', 'CONSENT_ASKED', 'CONSENTED', 'SHORTLISTED', 'INTERVIEW', 'HIRED', 'DECLINED', 'DROPPED', 'NOT_SUITABLE'] as const;
export type CandidateStage = (typeof CANDIDATE_STAGES)[number];
/** Stages after which the person is out of the search. */
export const OUT_STAGES: readonly string[] = ['DECLINED', 'DROPPED', 'NOT_SUITABLE'];

export const CLIENT_DECISIONS = ['INTERVIEW', 'NOT_SUITABLE', 'HIRED'] as const;
export type ClientDecision = (typeof CLIENT_DECISIONS)[number];

/** Keep this in step with the wording the candidate sees. A new wording needs a new version. */
export const CONSENT_VERSION = 'v1';
export const CONSENT_TEXT =
  'I agree that JobWahala may put me forward for this role, and share my profile, CV and contact details with the hiring company. I can change my mind any time before they contact me.';

export const MAX_MUST_HAVES = 8;
export const MIN_NOTE_LENGTH = 10;
export const DEFAULT_GUARANTEE_DAYS = 90;
export const REMINDER_DAYS_BEFORE = 7;

export const referenceFor = (year: number, sequence: number) => `HS-${year}-${String(sequence).padStart(4, '0')}`;

// ------------------------------------------------------------------ the status

/**
 * Where a request may go from where it is. A request in progress can move between the working statuses (an admin corrects it) or be
 * cancelled. A filled request only reopens through a replacement, and a cancelled one stays cancelled.
 */
export const canMoveStatus = (from: string, to: string) => {
  if (from === to) return false;
  if (from === 'CANCELLED') return false;
  if (from === 'FILLED') return false;
  return REQUEST_STATUSES.includes(to as RequestStatus);
};

// ------------------------------------------------------------------ money (whole pesewas)

export const ghsToPesewas = (value: unknown): number | null => {
  const number = typeof value === 'string' ? Number(value.replace(/[,\s]/g, '')) : typeof value === 'number' ? value : NaN;
  if (!Number.isFinite(number) || number < 0) return null;
  return Math.round(number * 100);
};

export const formatGhs = (pesewas: number) => `GHS ${(pesewas / 100).toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export type PaymentLine = { kind: string; amountPesewas: number };

/** What is agreed, what has been paid, and what is still due. The deposit is the part due first; the balance is everything after it. */
export const feeSummary = (input: { feePesewas: number | null; depositPesewas: number | null }, payments: PaymentLine[]) => {
  const fee = input.feePesewas ?? 0;
  const deposit = Math.min(input.depositPesewas ?? 0, fee);
  const paid = payments.reduce((sum, payment) => sum + payment.amountPesewas, 0);
  const depositPaid = Math.min(paid, deposit);
  return {
    agreed: input.feePesewas !== null,
    feePesewas: fee,
    depositPesewas: deposit,
    balancePesewas: fee - deposit,
    paidPesewas: paid,
    depositDuePesewas: deposit - depositPaid,
    balanceDuePesewas: Math.max(0, fee - deposit - Math.max(0, paid - deposit)),
    outstandingPesewas: Math.max(0, fee - paid),
    settled: input.feePesewas !== null && paid >= fee,
  };
};

// ------------------------------------------------------------------ the replacement guarantee

/** The guarantee runs from the day the person starts. */
export const guaranteeEnd = (startDate: Date, days: number) => new Date(startDate.getTime() + Math.max(0, Math.floor(days)) * DAY_MS);

/** A replacement can be asked for while the guarantee runs, after a hire. */
export const canRequestReplacement = (request: { status: string; guaranteeEndsAt: Date | null }, now = new Date()) =>
  request.status === 'FILLED' && Boolean(request.guaranteeEndsAt) && (request.guaranteeEndsAt as Date).getTime() >= now.getTime();

/** True when the guarantee ends within a week and staff have not been reminded yet. */
export const guaranteeReminderDue = (request: { status: string; guaranteeEndsAt: Date | null; guaranteeReminderSentAt: Date | null }, now = new Date()) => {
  if (request.status !== 'FILLED' || !request.guaranteeEndsAt || request.guaranteeReminderSentAt) return false;
  const left = request.guaranteeEndsAt.getTime() - now.getTime();
  return left > 0 && left <= REMINDER_DAYS_BEFORE * DAY_MS;
};

/** Whole days until the guarantee ends (negative once it has). */
export const guaranteeDaysLeft = (guaranteeEndsAt: Date | null, now = new Date()) => (guaranteeEndsAt ? Math.ceil((guaranteeEndsAt.getTime() - now.getTime()) / DAY_MS) : null);

// ------------------------------------------------------------------ the brief and optional ratings

/** Clean list of must-haves: trimmed, no blanks, no repeats (ignoring case), at most MAX_MUST_HAVES. */
export const cleanMustHaves = (values: unknown): string[] => {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of Array.isArray(values) ? values : []) {
    const text = typeof value === 'string' ? value.trim().replace(/\s+/g, ' ').slice(0, 120) : '';
    if (!text || seen.has(text.toLowerCase())) continue;
    seen.add(text.toLowerCase());
    out.push(text);
    if (out.length === MAX_MUST_HAVES) break;
  }
  return out;
};

export const parseJsonList = (json: string | null | undefined): string[] => {
  try {
    const value = JSON.parse(json || '[]');
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
};

export type Ratings = Record<string, number>;

export const parseRatings = (json: string | null | undefined): Ratings => {
  try {
    const value = JSON.parse(json || '{}');
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    return Object.fromEntries(Object.entries(value).filter(([, rating]) => Number.isInteger(rating) && (rating as number) >= 1 && (rating as number) <= 5)) as Ratings;
  } catch {
    return {};
  }
};

/** Keeps only ratings for the must-haves of this request, as whole numbers 1 to 5. */
export const cleanRatings = (mustHaves: string[], input: Record<string, unknown>): Ratings => {
  const out: Ratings = {};
  for (const mustHave of mustHaves) {
    const value = input[mustHave];
    if (typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 5) out[mustHave] = value;
  }
  return out;
};

/** 0 to 100: the ratings as a share of the best possible. null until every must-have has a rating. */
export const fitScore = (mustHaves: string[], ratings: Ratings): number | null => {
  if (mustHaves.length === 0) return null;
  if (!mustHaves.every((mustHave) => ratings[mustHave] !== undefined)) return null;
  const total = mustHaves.reduce((sum, mustHave) => sum + ratings[mustHave], 0);
  return Math.round((total / (mustHaves.length * 5)) * 100);
};

/** Why a person cannot be shortlisted yet, or null when they can. Every shortlisted person needs our note and their agreement. */
export const shortlistBlocker = (candidate: { stage: string; consentAt: Date | null; clientSummary: string | null }): string | null => {
  if (OUT_STAGES.includes(candidate.stage)) return 'This person is no longer in the search.';
  if (!candidate.consentAt) return 'They have not agreed to be put forward yet.';
  if ((candidate.clientSummary ?? '').trim().length < MIN_NOTE_LENGTH) return `Write a short note for the employer (at least ${MIN_NOTE_LENGTH} characters).`;
  return null;
};

const STOP_WORDS = new Set(['with', 'that', 'this', 'have', 'from', 'will', 'must', 'able', 'good', 'work', 'years', 'year', 'and', 'the', 'for', 'are', 'who', 'our', 'you', 'your', 'experience', 'required', 'ability', 'skills', 'strong']);

/** The words in a brief that say what the role needs: distinct, longer than three letters, not filler. */
export const briefKeywords = (text: string, limit = 14) => {
  const seen = new Set<string>();
  for (const word of text.toLowerCase().split(/[^a-z0-9+#]+/)) {
    if (word.length > 3 && !STOP_WORDS.has(word)) seen.add(word);
    if (seen.size === limit) break;
  }
  return [...seen];
};

/** How much of the brief a profile's words cover (0 to 100). A search aid for staff, never shown to employers. */
export const relevance = (keywords: string[], profileText: string) => {
  if (keywords.length === 0) return 0;
  const haystack = profileText.toLowerCase();
  return Math.round((keywords.filter((word) => haystack.includes(word)).length / keywords.length) * 100);
};

// ------------------------------------------------------------------ what each person may see

type CandidateRow = {
  id: string;
  stage: string;
  source: string;
  consentAt: Date | null;
  consentAskedAt?: Date | null;
  fitScore: number | null;
  ratingsJson: string;
  clientSummary: string | null;
  staffNotes: string | null;
  shortlistedAt: Date | null;
  clientDecision: string | null;
  clientDecisionNote: string | null;
  clientDecidedAt: Date | null;
  startDate?: Date | null;
  declineReason?: string | null;
  createdAt: Date;
};

export type ProfileFacts = {
  name: string;
  headline: string | null;
  skills: string | null;
  experience: string | null;
  location: string | null;
  educationLevel: string | null;
  yearsExperience: number | null;
  verifiedCertificate: boolean;
  identityVerified: boolean;
  email: string | null;
  phone: string | null;
  cvUrl: string | null;
  cvFileName: string | null;
};

/** A candidate is in the employer's shortlist once they have agreed, been shortlisted and are still in the search (or the employer already decided on them). */
export const isClientVisible = (candidate: Pick<CandidateRow, 'stage' | 'consentAt' | 'shortlistedAt'>) =>
  Boolean(candidate.consentAt) && Boolean(candidate.shortlistedAt) && !['DECLINED', 'DROPPED'].includes(candidate.stage);

/** What the employer reads about a candidate. Never staff notes, never how the person was found, and nothing before they agreed. */
export const clientCandidateView = (candidate: CandidateRow, facts: ProfileFacts, mustHaves: string[]) => {
  const ratings = parseRatings(candidate.ratingsJson);
  return {
    id: candidate.id,
    stage: candidate.stage,
    name: facts.name,
    headline: facts.headline,
    skills: facts.skills,
    experience: facts.experience,
    location: facts.location,
    educationLevel: facts.educationLevel,
    yearsExperience: facts.yearsExperience,
    verifiedCertificate: facts.verifiedCertificate,
    identityVerified: facts.identityVerified,
    fitScore: candidate.fitScore,
    ratings: mustHaves.map((mustHave) => ({ mustHave, rating: ratings[mustHave] ?? null })),
    note: candidate.clientSummary,
    email: facts.email,
    phone: facts.phone,
    cv: facts.cvUrl ? { url: facts.cvUrl, fileName: facts.cvFileName } : null,
    decision: candidate.clientDecision,
    decisionNote: candidate.clientDecisionNote,
    startDate: candidate.startDate ?? null,
    shortlistedAt: candidate.shortlistedAt,
  };
};

/** The staff view of a candidate: everything, including notes. Details a person has not agreed to share are held back (see `open`). */
export const staffCandidateView = (candidate: CandidateRow, facts: ProfileFacts, mustHaves: string[], open: boolean) => {
  const ratings = parseRatings(candidate.ratingsJson);
  return {
    id: candidate.id,
    stage: candidate.stage,
    source: candidate.source,
    consentAt: candidate.consentAt,
    consentAskedAt: candidate.consentAskedAt ?? null,
    declineReason: candidate.declineReason ?? null,
    fitScore: candidate.fitScore,
    ratings: mustHaves.map((mustHave) => ({ mustHave, rating: ratings[mustHave] ?? null })),
    note: candidate.clientSummary,
    staffNotes: candidate.staffNotes,
    shortlistedAt: candidate.shortlistedAt,
    decision: candidate.clientDecision,
    decisionNote: candidate.clientDecisionNote,
    startDate: candidate.startDate ?? null,
    // Until the person agrees, a hidden profile shows only its headline: no name, no contact, no CV.
    detailsOpen: open,
    name: open ? facts.name : 'Candidate (profile not open yet)',
    headline: facts.headline,
    skills: open ? facts.skills : null,
    experience: open ? facts.experience : null,
    location: facts.location,
    educationLevel: facts.educationLevel,
    yearsExperience: facts.yearsExperience,
    verifiedCertificate: facts.verifiedCertificate,
    identityVerified: facts.identityVerified,
    email: open ? facts.email : null,
    phone: open ? facts.phone : null,
    cv: open && facts.cvUrl ? { url: facts.cvUrl, fileName: facts.cvFileName } : null,
  };
};

type RequestForCandidate = { roleTitle: string; location: string; salaryMin: number | null; salaryMax: number | null; requirements: string; startDate: Date | null };

const clip = (value: string, max: number) => (value.length <= max ? value : `${value.slice(0, max - 1).trimEnd()}…`);

/** The role a candidate sees when asked: what it is, where, the pay, and who is asking. */
export const opportunityView = (request: RequestForCandidate, company: { name: string }, recruiter: { name: string; title: string | null } | null) => ({
  roleTitle: request.roleTitle,
  location: request.location,
  salaryMin: request.salaryMin,
  salaryMax: request.salaryMax,
  startDate: request.startDate,
  description: clip(request.requirements, 1200),
  company: company.name,
  recruiter: recruiter ? { name: recruiter.name, title: recruiter.title } : null,
  consentText: CONSENT_TEXT,
  consentVersion: CONSENT_VERSION,
});
