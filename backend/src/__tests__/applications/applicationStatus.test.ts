import { describe, expect, it } from 'vitest';
import { applicationStatusValues, updateApplicationStatusSchema } from '../../validation/jobSchemas';
import {
  STAGE_LABEL,
  describeStatusChange,
  isFirstResponse,
  lastChangedAt,
  nextResponseStats,
  reminderCutoff,
  responseHours,
} from '../../utils/applicationStatus';

const context = { jobTitle: 'Hotel Receptionist', company: 'Achiba Star Hotel' };

describe('stages', () => {
  it('has an Offered stage the API accepts', () => {
    expect(applicationStatusValues).toContain('OFFERED');
    expect(updateApplicationStatusSchema.safeParse({ body: { status: 'OFFERED' }, params: { applicationId: 'a' } }).success).toBe(true);
    expect(updateApplicationStatusSchema.safeParse({ body: { status: 'MAYBE' }, params: { applicationId: 'a' } }).success).toBe(false);
  });

  it('calls SUBMITTED "New" for people', () => {
    expect(STAGE_LABEL.SUBMITTED).toBe('New');
    expect(STAGE_LABEL.OFFERED).toBe('Offered');
  });
});

describe('describeStatusChange', () => {
  it('writes a friendly message for every stage that notifies', () => {
    for (const status of ['SHORTLISTED', 'INTERVIEW', 'OFFERED', 'HIRED', 'REJECTED']) {
      const message = describeStatusChange(status, context)!;
      expect(message.title.length).toBeGreaterThan(5);
      expect(message.message).toContain('Hotel Receptionist');
      expect(message.message + message.title).toContain('Achiba Star Hotel');
    }
  });

  it('says something different for each stage', () => {
    const titles = ['SHORTLISTED', 'INTERVIEW', 'OFFERED', 'HIRED', 'REJECTED'].map((s) => describeStatusChange(s, context)!.title);
    expect(new Set(titles).size).toBe(5);
  });

  it('is warm about good news', () => {
    expect(describeStatusChange('SHORTLISTED', context)!.title).toMatch(/good news/i);
    expect(describeStatusChange('OFFERED', context)!.message).toMatch(/congratulations/i);
    expect(describeStatusChange('HIRED', context)!.title).toMatch(/congratulations/i);
    expect(describeStatusChange('INTERVIEW', context)!.message).toMatch(/good luck/i);
  });

  it('is polite and respectful when rejecting', () => {
    const { title, message } = describeStatusChange('REJECTED', context)!;
    const text = `${title} ${message}`;

    expect(message).toMatch(/thank you for applying/i);
    expect(message).toMatch(/not the news you hoped for/i);
    expect(message).toMatch(/new roles are added every day/i);
    // No harsh or blaming wording, and the label "rejected" is not thrown at the person.
    expect(text).not.toMatch(/reject|fail|unsuccessful|unqualified|not good enough|regret/i);
  });

  it('sends nothing when an application goes back to New or for unknown stages', () => {
    expect(describeStatusChange('SUBMITTED', context)).toBeNull();
    expect(describeStatusChange('WEIRD', context)).toBeNull();
  });
});

describe('response time', () => {
  const applied = new Date('2026-11-01T08:00:00.000Z');

  it('counts hours from applying to the first response, never below zero', () => {
    expect(responseHours(applied, new Date('2026-11-01T14:00:00.000Z'))).toBe(6);
    expect(responseHours(applied, new Date('2026-11-01T07:00:00.000Z'))).toBe(0);
  });

  it('keeps a running average', () => {
    const first = nextResponseStats({ avgResponseHours: null, responseCount: 0 }, 6);
    expect(first).toEqual({ avgResponseHours: 6, responseCount: 1 });

    const second = nextResponseStats(first, 2);
    expect(second).toEqual({ avgResponseHours: 4, responseCount: 2 });

    const third = nextResponseStats(second, 9);
    expect(third.responseCount).toBe(3);
    expect(third.avgResponseHours).toBeCloseTo(5.667, 2);
  });

  it('does not round as it goes, so the average does not drift', () => {
    let stats = { avgResponseHours: null as number | null, responseCount: 0 };
    for (const hours of [1, 2, 2, 1, 2, 2]) stats = nextResponseStats(stats, hours);
    expect(stats.avgResponseHours).toBeCloseTo(10 / 6, 10);
  });

  it('only the first move out of New counts as a response', () => {
    expect(isFirstResponse({ status: 'SUBMITTED', firstRespondedAt: null }, 'SHORTLISTED')).toBe(true);
    expect(isFirstResponse({ status: 'SUBMITTED', firstRespondedAt: null }, 'REJECTED')).toBe(true);
    expect(isFirstResponse({ status: 'SUBMITTED', firstRespondedAt: null }, 'SUBMITTED')).toBe(false);
    expect(isFirstResponse({ status: 'SHORTLISTED', firstRespondedAt: null }, 'INTERVIEW')).toBe(false);
    expect(isFirstResponse({ status: 'SUBMITTED', firstRespondedAt: new Date() }, 'SHORTLISTED')).toBe(false);
  });
});

describe('reminders and last change', () => {
  it('waits 14 days', () => {
    const now = new Date('2026-11-20T12:00:00.000Z');
    expect(reminderCutoff(now).toISOString()).toBe('2026-11-06T12:00:00.000Z');
  });

  it('falls back to updatedAt when a status change was never recorded', () => {
    const updatedAt = new Date('2026-10-01T00:00:00.000Z');
    const changed = new Date('2026-10-05T00:00:00.000Z');
    expect(lastChangedAt({ statusChangedAt: null, updatedAt })).toBe(updatedAt);
    expect(lastChangedAt({ statusChangedAt: changed, updatedAt })).toBe(changed);
  });
});
