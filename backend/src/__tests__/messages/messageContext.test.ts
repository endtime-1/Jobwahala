import { describe, expect, it } from 'vitest';
import { latestContextByPerson } from '../../utils/messageContext';

const application = (seekerId: string, employerId: string, jobId: string, title: string, status: string, day: number) => ({
  seekerId,
  status,
  createdAt: new Date(`2026-11-${String(day).padStart(2, '0')}T10:00:00Z`),
  job: { id: jobId, title, employerId },
});

describe('what a conversation is about', () => {
  it('for an employer, it is the job the other person applied to', () => {
    const map = latestContextByPerson([application('seeker-1', 'emp-1', 'j1', 'Accountant', 'SHORTLISTED', 3)], 'emp-1');

    expect(map.get('seeker-1')).toEqual({ jobId: 'j1', jobTitle: 'Accountant', status: 'SHORTLISTED' });
  });

  it('for a job seeker, it is the job they applied for, and the other person is the employer', () => {
    const map = latestContextByPerson([application('me', 'emp-9', 'j2', 'Sales Executive', 'SUBMITTED', 5)], 'me');

    expect(map.get('emp-9')).toEqual({ jobId: 'j2', jobTitle: 'Sales Executive', status: 'SUBMITTED' });
  });

  it('with several applications between the same two people, the newest one wins', () => {
    const map = latestContextByPerson(
      [application('seeker-1', 'emp-1', 'old', 'Old job', 'REJECTED', 1), application('seeker-1', 'emp-1', 'new', 'New job', 'HIRED', 9), application('seeker-1', 'emp-1', 'mid', 'Mid job', 'SUBMITTED', 4)],
      'emp-1',
    );

    expect(map.get('seeker-1')?.jobId).toBe('new');
  });

  it('keeps different people apart, and has nothing for someone with no application', () => {
    const map = latestContextByPerson([application('a', 'emp-1', 'j1', 'One', 'SUBMITTED', 2), application('b', 'emp-1', 'j2', 'Two', 'SUBMITTED', 3)], 'emp-1');

    expect(map.get('a')?.jobTitle).toBe('One');
    expect(map.get('b')?.jobTitle).toBe('Two');
    expect(map.get('c')).toBeUndefined();
  });
});
