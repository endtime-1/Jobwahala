import { describe, expect, it } from 'vitest';
import { criteriaKey, describeCriteria, hasCriteria, searchMatchesJob } from '../../utils/jobAlerts';

const job = {
  title: 'Hotel Receptionist',
  description: 'Front desk, guest relations and customer service in Kumasi',
  category: 'Hospitality',
  location: 'Kumasi',
  type: 'Full-time',
};

describe('searchMatchesJob', () => {
  it('requires at least one criterion so an empty search never alerts', () => {
    expect(hasCriteria({})).toBe(false);
    expect(searchMatchesJob({}, job)).toBe(false);
    expect(searchMatchesJob({ query: '   ' }, job)).toBe(false);
  });

  it('matches when every query word appears in title, category or description', () => {
    expect(searchMatchesJob({ query: 'receptionist' }, job)).toBe(true);
    expect(searchMatchesJob({ query: 'front desk' }, job)).toBe(true);
    expect(searchMatchesJob({ query: 'hospitality customer' }, job)).toBe(true);
  });

  it('is an AND so a partly relevant job does not alert', () => {
    expect(searchMatchesJob({ query: 'receptionist welding' }, job)).toBe(false);
  });

  it('is case and spacing insensitive', () => {
    expect(searchMatchesJob({ query: '  RECEPTIONIST   ' }, job)).toBe(true);
  });

  it('filters by location text and exact job type', () => {
    expect(searchMatchesJob({ location: 'kumasi' }, job)).toBe(true);
    expect(searchMatchesJob({ location: 'accra' }, job)).toBe(false);
    expect(searchMatchesJob({ jobType: 'full-time' }, job)).toBe(true);
    expect(searchMatchesJob({ jobType: 'part-time' }, job)).toBe(false);
  });

  it('needs every set criterion to hold', () => {
    expect(searchMatchesJob({ query: 'receptionist', location: 'Kumasi', jobType: 'Full-time' }, job)).toBe(true);
    expect(searchMatchesJob({ query: 'receptionist', location: 'Accra' }, job)).toBe(false);
  });

  it('handles jobs with missing fields', () => {
    expect(searchMatchesJob({ location: 'Accra' }, { title: 'Cook' })).toBe(false);
    expect(searchMatchesJob({ query: 'cook' }, { title: 'Cook' })).toBe(true);
  });
});

describe('criteriaKey and describeCriteria', () => {
  it('treats formatting differences as the same search', () => {
    expect(criteriaKey({ query: ' Excel  ', location: 'ACCRA' })).toBe(criteriaKey({ query: 'excel', location: 'accra' }));
    expect(criteriaKey({ query: 'excel' })).not.toBe(criteriaKey({ query: 'excel', jobType: 'Full-time' }));
  });

  it('describes a search for notifications', () => {
    expect(describeCriteria({ query: 'Excel', location: 'Accra', jobType: null })).toBe('Excel · Accra');
  });
});
