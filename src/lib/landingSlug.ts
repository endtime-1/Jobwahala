/** Does this address look like a search landing page ("jobs-in-accra", "banking-jobs", "jobs-by-location")? */
export const looksLikeLandingSlug = (slug: string) =>
  slug === 'jobs-by-location' ||
  slug === 'jobs-by-category' ||
  /^jobs-in-[a-z0-9-]+$/.test(slug) ||
  /^[a-z0-9-]+-jobs$/.test(slug) ||
  /^[a-z0-9-]+-jobs-in-[a-z0-9-]+$/.test(slug)
