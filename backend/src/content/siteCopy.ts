/**
 * The words that describe JobWahala to the world, in ONE place.
 *
 * Used by the home page hero, the page title and descriptions, the static page that paints before
 * JavaScript loads (index.html, filled in at build time by vite.config.ts) and the crawler pages served by
 * the backend. `backend/src/content/siteCopy.ts` must be an exact copy of this file: a backend test fails
 * if the two ever differ. Change the words here, copy the file, done.
 */
export const siteCopy = {
  brandLine: 'Work without the wahala.',
  title: 'Real jobs from employers you can check, across Africa',
  // The paragraph under the hero heading, on the page and in the static shell.
  heroText:
    'Real jobs from employers you can check, across Africa. See the pay and location before you apply, and look for the verified badge.',
  description:
    'Find real jobs across Africa from employers you can check, or post your jobs free and review applicants on one board. Pay and location shown up front. Freelance gigs coming soon.',
  shortDescription: 'Find real jobs across Africa, or post your jobs free. Work without the wahala.',
  // What search engines are told about the home page when the app itself is not run.
  crawlerIntro: 'JobWahala is a job portal for Africa. Companies post real jobs and people apply in minutes.',
} as const
