import { describe, expect, it } from 'vitest';
import {
  ClosingDateError,
  addDays,
  canChangeStatus,
  closesAtFromDays,
  daysLeft,
  isOwnerManaged,
  publicJobWhere,
  resolveClosesAt,
} from '../../utils/jobLifecycle';

const now = new Date('2026-11-04T10:00:00.000Z');

describe('resolveClosesAt', () => {
  it('defaults to 30 days from now', () => {
    expect(resolveClosesAt(undefined, now).toISOString()).toBe('2026-12-04T10:00:00.000Z');
    expect(resolveClosesAt('', now).toISOString()).toBe('2026-12-04T10:00:00.000Z');
    expect(resolveClosesAt(null, now).toISOString()).toBe('2026-12-04T10:00:00.000Z');
  });

  it('treats a date as the end of that day', () => {
    expect(resolveClosesAt('2026-11-20', now).toISOString()).toBe('2026-11-20T23:59:59.999Z');
  });

  it('allows closing later today', () => {
    expect(resolveClosesAt('2026-11-04', now).toISOString()).toBe('2026-11-04T23:59:59.999Z');
  });

  it('accepts exactly 90 days from today and rejects 91', () => {
    expect(resolveClosesAt('2027-02-02', now).toISOString()).toBe('2027-02-02T23:59:59.999Z');
    expect(() => resolveClosesAt('2027-02-03', now)).toThrow(ClosingDateError);
  });

  it('rejects dates in the past and nonsense', () => {
    expect(() => resolveClosesAt('2026-11-03', now)).toThrow(/future/);
    expect(() => resolveClosesAt('2026-11-04T09:00:00.000Z', now)).toThrow(/future/);
    expect(() => resolveClosesAt('next week', now)).toThrow(/valid/);
  });
});

describe('closesAtFromDays', () => {
  it('counts from today and defaults to 30', () => {
    expect(closesAtFromDays(undefined, now).toISOString()).toBe('2026-12-04T23:59:59.999Z');
    expect(closesAtFromDays(7, now).toISOString()).toBe('2026-11-11T23:59:59.999Z');
  });

  it('allows 1 to 90 whole days only', () => {
    expect(() => closesAtFromDays(0, now)).toThrow(ClosingDateError);
    expect(() => closesAtFromDays(91, now)).toThrow(ClosingDateError);
    expect(() => closesAtFromDays(2.5, now)).toThrow(ClosingDateError);
    expect(() => closesAtFromDays(90, now)).not.toThrow();
  });
});

describe('publicJobWhere', () => {
  it('only matches ACTIVE jobs that have not passed their closing date', () => {
    expect(publicJobWhere(now)).toEqual({ status: 'ACTIVE', closesAt: { gt: now } });
  });
});

describe('status transitions', () => {
  it('lets owners publish, pause, resume, close and reopen', () => {
    expect(canChangeStatus('DRAFT', 'ACTIVE')).toBe(true);
    expect(canChangeStatus('ACTIVE', 'PAUSED')).toBe(true);
    expect(canChangeStatus('PAUSED', 'ACTIVE')).toBe(true);
    expect(canChangeStatus('ACTIVE', 'CLOSED')).toBe(true);
    expect(canChangeStatus('PAUSED', 'CLOSED')).toBe(true);
    expect(canChangeStatus('CLOSED', 'ACTIVE')).toBe(true);
  });

  it('does not let owners skip steps', () => {
    expect(canChangeStatus('DRAFT', 'PAUSED')).toBe(false);
    expect(canChangeStatus('DRAFT', 'CLOSED')).toBe(false);
    expect(canChangeStatus('CLOSED', 'PAUSED')).toBe(false);
  });

  it('opens an expired job only through extending, never a status change', () => {
    for (const to of ['ACTIVE', 'PAUSED', 'CLOSED']) expect(canChangeStatus('EXPIRED', to)).toBe(false);
  });

  it('keeps moderated jobs out of the owners hands', () => {
    for (const status of ['FLAGGED', 'SUSPENDED']) {
      expect(isOwnerManaged(status)).toBe(false);
      expect(canChangeStatus(status, 'ACTIVE')).toBe(false);
    }
    for (const status of ['DRAFT', 'ACTIVE', 'PAUSED', 'CLOSED', 'EXPIRED']) expect(isOwnerManaged(status)).toBe(true);
  });
});

describe('daysLeft', () => {
  it('rounds up and never goes below zero', () => {
    expect(daysLeft(addDays(now, 3), now)).toBe(3);
    expect(daysLeft(new Date(now.getTime() + 3 * 86_400_000 + 3_600_000), now)).toBe(4);
    expect(daysLeft(new Date(now.getTime() - 1000), now)).toBe(0);
  });
});
