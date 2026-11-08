import { describe, expect, it } from 'vitest';
import {
  CONSENT_TEXT,
  briefKeywords,
  canMoveStatus,
  canRequestReplacement,
  cleanMustHaves,
  cleanRatings,
  clientCandidateView,
  feeSummary,
  fitScore,
  formatGhs,
  ghsToPesewas,
  guaranteeDaysLeft,
  guaranteeEnd,
  guaranteeReminderDue,
  isClientVisible,
  opportunityView,
  parseRatings,
  referenceFor,
  relevance,
  shortlistBlocker,
  staffCandidateView,
  type ProfileFacts,
} from '../../utils/hiring';

const DAY = 86_400_000;
const at = (iso: string) => new Date(iso);

describe('the status of a request', () => {
  it('moves between the working statuses and can be cancelled; a filled or cancelled request stays', () => {
    expect(canMoveStatus('NEW', 'AGREED')).toBe(true);
    expect(canMoveStatus('AGREED', 'SOURCING')).toBe(true);
    expect(canMoveStatus('SOURCING', 'CANCELLED')).toBe(true);
    expect(canMoveStatus('INTERVIEWING', 'SOURCING')).toBe(true);
    expect(canMoveStatus('SOURCING', 'SOURCING')).toBe(false);
    expect(canMoveStatus('FILLED', 'SOURCING')).toBe(false);
    expect(canMoveStatus('CANCELLED', 'NEW')).toBe(false);
    expect(canMoveStatus('NEW', 'NONSENSE')).toBe(false);
  });

  it('writes references like HS-2026-0007', () => {
    expect(referenceFor(2026, 7)).toBe('HS-2026-0007');
  });
});

describe('the fee, the deposit and the balance', () => {
  it('turns cedis into whole pesewas', () => {
    expect(ghsToPesewas(1500)).toBe(150000);
    expect(ghsToPesewas('1,250.50')).toBe(125050);
    expect(ghsToPesewas(-1)).toBeNull();
    expect(ghsToPesewas('abc')).toBeNull();
    expect(formatGhs(150000)).toBe('GHS 1,500.00');
  });

  it('works out what is agreed, paid and still due', () => {
    const none = feeSummary({ feePesewas: 300000, depositPesewas: 100000 }, []);
    expect(none).toMatchObject({ agreed: true, feePesewas: 300000, depositPesewas: 100000, balancePesewas: 200000, paidPesewas: 0, depositDuePesewas: 100000, balanceDuePesewas: 200000, outstandingPesewas: 300000, settled: false });

    const depositPaid = feeSummary({ feePesewas: 300000, depositPesewas: 100000 }, [{ kind: 'DEPOSIT', amountPesewas: 100000 }]);
    expect(depositPaid).toMatchObject({ depositDuePesewas: 0, balanceDuePesewas: 200000, outstandingPesewas: 200000, settled: false });

    const part = feeSummary({ feePesewas: 300000, depositPesewas: 100000 }, [{ kind: 'DEPOSIT', amountPesewas: 100000 }, { kind: 'BALANCE', amountPesewas: 50000 }]);
    expect(part).toMatchObject({ balanceDuePesewas: 150000, outstandingPesewas: 150000, paidPesewas: 150000 });

    const all = feeSummary({ feePesewas: 300000, depositPesewas: 100000 }, [{ kind: 'DEPOSIT', amountPesewas: 100000 }, { kind: 'BALANCE', amountPesewas: 200000 }]);
    expect(all).toMatchObject({ outstandingPesewas: 0, balanceDuePesewas: 0, settled: true });
  });

  it('says nothing is agreed until a fee is set, and never lets the deposit exceed the fee', () => {
    expect(feeSummary({ feePesewas: null, depositPesewas: null }, []).agreed).toBe(false);
    expect(feeSummary({ feePesewas: 100000, depositPesewas: 500000 }, []).depositPesewas).toBe(100000);
  });
});

describe('the replacement guarantee', () => {
  it('runs from the day the person starts, for the days set', () => {
    expect(guaranteeEnd(at('2026-12-01T00:00:00Z'), 90).toISOString()).toBe('2027-03-01T00:00:00.000Z');
    expect(guaranteeEnd(at('2026-12-01T00:00:00Z'), 0).toISOString()).toBe('2026-12-01T00:00:00.000Z');
  });

  const now = at('2027-02-20T10:00:00Z');
  const filled = (days: number, extra: Record<string, unknown> = {}) => ({ status: 'FILLED', guaranteeEndsAt: new Date(now.getTime() + days * DAY), guaranteeReminderSentAt: null as Date | null, ...extra });

  it('is claimable only while it runs, after a hire', () => {
    expect(canRequestReplacement(filled(5), now)).toBe(true);
    expect(canRequestReplacement(filled(-1), now)).toBe(false);
    expect(canRequestReplacement({ status: 'SOURCING', guaranteeEndsAt: filled(5).guaranteeEndsAt }, now)).toBe(false);
  });

  it('is due a reminder in the last week, once', () => {
    expect(guaranteeReminderDue(filled(7), now)).toBe(true);
    expect(guaranteeReminderDue(filled(3), now)).toBe(true);
    expect(guaranteeReminderDue(filled(8), now)).toBe(false); // more than a week away
    expect(guaranteeReminderDue(filled(-1), now)).toBe(false); // already over
    expect(guaranteeReminderDue(filled(3, { guaranteeReminderSentAt: now }), now)).toBe(false);
    expect(guaranteeReminderDue(filled(3, { status: 'SOURCING' }), now)).toBe(false);
    expect(guaranteeDaysLeft(filled(5).guaranteeEndsAt, now)).toBe(5);
    expect(guaranteeDaysLeft(null)).toBeNull();
  });
});

describe('the brief and the optional ratings', () => {
  it('cleans the must-haves and ratings', () => {
    expect(cleanMustHaves(['  Cash handling ', 'cash handling', '', 5, 'Fluent English'])).toEqual(['Cash handling', 'Fluent English']);
    expect(cleanRatings(['A', 'B'], { A: 5, B: 6, C: 4 })).toEqual({ A: 5 });
    expect(parseRatings('{"A":3,"B":0}')).toEqual({ A: 3 });
    expect(fitScore(['A', 'B'], { A: 4, B: 2 })).toBe(60);
    expect(fitScore(['A', 'B'], { A: 5 })).toBeNull();
    expect(fitScore([], {})).toBeNull();
  });

  it('finds the words that say what the role needs, and how much of them a profile covers', () => {
    const words = briefKeywords('Cashier needed. Must have cash handling and POS experience, fluent English required.');
    expect(words).toEqual(expect.arrayContaining(['cashier', 'cash', 'handling', 'fluent', 'english']));
    expect(words).not.toContain('experience');
    expect(relevance(['cash', 'pos', 'english'], 'Cashier with cash and POS skills')).toBe(67);
    expect(relevance([], 'x')).toBe(0);
  });
});

describe('who may be shortlisted', () => {
  const ready = { stage: 'CONSENTED', consentAt: at('2026-11-12T00:00:00Z'), clientSummary: 'Strong cashier, five years in busy shops.' };
  it('needs their agreement and our short note', () => {
    expect(shortlistBlocker(ready)).toBeNull();
    expect(shortlistBlocker({ ...ready, consentAt: null })).toMatch(/agreed/);
    expect(shortlistBlocker({ ...ready, clientSummary: 'Good' })).toMatch(/short note/);
    expect(shortlistBlocker({ ...ready, clientSummary: null })).toMatch(/short note/);
    expect(shortlistBlocker({ ...ready, stage: 'DECLINED' })).toMatch(/no longer/);
    expect(shortlistBlocker({ ...ready, stage: 'NOT_SUITABLE' })).toMatch(/no longer/);
  });
});

const facts: ProfileFacts = {
  name: 'Ama Mensah', headline: 'Cashier', skills: 'cash handling, POS', experience: 'Five years', location: 'Kumasi', educationLevel: 'DIPLOMA', yearsExperience: 5,
  verifiedCertificate: true, identityVerified: false, email: 'ama@example.com', phone: '+233241234567', cvUrl: '/api/uploads/cv/ama.pdf', cvFileName: 'ama.pdf',
};

const row = (extra: Record<string, unknown> = {}) => ({
  id: 'c-1', stage: 'SHORTLISTED', source: 'CV_DATABASE', consentAt: at('2026-11-12T00:00:00Z'), consentAskedAt: at('2026-11-11T00:00:00Z'), fitScore: 80,
  ratingsJson: '{"Cash handling":4}', clientSummary: 'A strong cashier.', staffNotes: 'Asked for a higher salary. Call after 5pm.', shortlistedAt: at('2026-11-13T00:00:00Z'),
  clientDecision: null, clientDecisionNote: null, clientDecidedAt: null, startDate: null, declineReason: null, createdAt: at('2026-11-10T00:00:00Z'), ...extra,
});

describe('what each person is allowed to see', () => {
  it('shows the employer only agreed, shortlisted people still in the search', () => {
    expect(isClientVisible(row())).toBe(true);
    expect(isClientVisible(row({ consentAt: null }))).toBe(false);
    expect(isClientVisible(row({ shortlistedAt: null }))).toBe(false);
    expect(isClientVisible(row({ stage: 'DROPPED' }))).toBe(false);
    expect(isClientVisible(row({ stage: 'NOT_SUITABLE' }))).toBe(true); // the employer's own decision stays visible to them
  });

  it('never gives the employer staff notes, the source or the consent trail', () => {
    const view = clientCandidateView(row(), facts, ['Cash handling']);
    const text = JSON.stringify(view);
    expect(text).not.toContain('higher salary');
    expect(text).not.toContain('CV_DATABASE');
    expect(view).not.toHaveProperty('staffNotes');
    expect(view).not.toHaveProperty('source');
    expect(view).not.toHaveProperty('consentAt');
    expect(view.note).toBe('A strong cashier.');
    expect(view.email).toBe('ama@example.com');
    expect(view.cv).toEqual({ url: '/api/uploads/cv/ama.pdf', fileName: 'ama.pdf' });
  });

  it('holds back a hidden profile from staff until the person agrees: no name, contact or CV', () => {
    const closed = staffCandidateView(row({ consentAt: null, stage: 'SOURCED' }), facts, [], false);
    expect(closed.detailsOpen).toBe(false);
    expect(closed.name).toBe('Candidate (profile not open yet)');
    expect(closed.email).toBeNull();
    expect(closed.cv).toBeNull();
    const open = staffCandidateView(row(), facts, [], true);
    expect(open.name).toBe('Ama Mensah');
    expect(open.staffNotes).toContain('higher salary');
  });

  it('tells a candidate the role, the company and exactly what yes means', () => {
    const view = opportunityView({ roleTitle: 'Cashier', location: 'Kumasi', salaryMin: 1500, salaryMax: 2000, requirements: 'Run the till.', startDate: null }, { name: 'Akoko Solutions' }, { name: 'Kofi', title: 'Recruiter' });
    expect(view.company).toBe('Akoko Solutions');
    expect(view.consentText).toBe(CONSENT_TEXT);
    expect(view.consentText).toMatch(/contact details/);
    expect(view.recruiter).toEqual({ name: 'Kofi', title: 'Recruiter' });
  });
});
