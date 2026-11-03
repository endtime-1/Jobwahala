export type SearchCriteria = {
  query?: string | null;
  location?: string | null;
  jobType?: string | null;
};

export type AlertableJob = {
  title?: string | null;
  description?: string | null;
  category?: string | null;
  location?: string | null;
  type?: string | null;
};

const norm = (value?: string | null) => (value || '').toLowerCase().replace(/\s+/g, ' ').trim();

export const hasCriteria = (criteria: SearchCriteria) =>
  Boolean(norm(criteria.query) || norm(criteria.location) || norm(criteria.jobType));

/** Stable key so the same search cannot be saved twice. */
export const criteriaKey = (criteria: SearchCriteria) =>
  [norm(criteria.query), norm(criteria.location), norm(criteria.jobType)].join('|');

/**
 * A saved search matches a job when every criterion it sets is satisfied:
 * every word of the query appears in the title, category or description (AND, so alerts stay
 * relevant), the location text is contained in the job location, and the job type is equal.
 */
export const searchMatchesJob = (criteria: SearchCriteria, job: AlertableJob) => {
  if (!hasCriteria(criteria)) return false;

  const query = norm(criteria.query);
  if (query) {
    const haystack = norm([job.title, job.category, job.description].filter(Boolean).join(' '));
    if (!query.split(' ').every((word) => haystack.includes(word))) return false;
  }

  const location = norm(criteria.location);
  if (location && !norm(job.location).includes(location)) return false;

  const jobType = norm(criteria.jobType);
  if (jobType && norm(job.type) !== jobType) return false;

  return true;
};

export const describeCriteria = (criteria: SearchCriteria) =>
  [criteria.query?.trim(), criteria.location?.trim(), criteria.jobType?.trim()].filter(Boolean).join(' · ');
