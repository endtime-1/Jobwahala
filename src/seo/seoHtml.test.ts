import { checkPage, expectations, visibleWords } from '../../scripts/seoHtmlCheck.mjs'
import { describe, expect, it } from 'vitest'
import { mergeIntoAppShell } from '../../backend/src/utils/appShell'
import { renderHomePage, renderJobListPage, renderJobPage, type SeoJob } from '../../backend/src/utils/seoPages'

/**
 * The same checks that run against the live site (npm run seo:check), run here against the pages the server makes,
 * as they are sent: merged into the app shell, with no JavaScript run.
 */
const SITE = 'https://www.jobwahala.com'
const SHELL = `<!doctype html><html><head><script type="module" crossorigin src="/assets/index-abc.js"></script><link rel="stylesheet" href="/assets/index-abc.css"></head><body><div id="root"></div></body></html>`

const job = (n: number): SeoJob => ({
  id: `job-${n}`,
  title: `Customer Support Agent ${n}`,
  description: 'Answer customer questions by phone and email. You will log every request, follow up until it is solved, and help the team keep response times short.\nYou need good English and a calm voice.',
  location: 'Kumasi, Ashanti',
  type: 'Full-time',
  salary: 'GHS 2,000 a month',
  salaryMin: 2000,
  createdAt: new Date('2026-11-01T09:00:00Z'),
  closesAt: new Date('2026-12-01T09:00:00Z'),
  employerName: 'Sunrise Microfinance',
})

const jobs = [1, 2, 3].map(job)
const send = (html: string) => mergeIntoAppShell(html, SHELL)

describe('public pages are readable without JavaScript', () => {
  it('the home page has the heading, sections, job links, canonical link and Organization/WebSite data', () => {
    const html = send(renderHomePage({ jobs, siteUrl: SITE, intro: 'JobWahala is a job portal for Africa.', description: 'Find real jobs across Africa from employers you can check, or post jobs free.' }))
    expect(checkPage(html, { ...expectations.home, siteUrl: SITE })).toEqual([])
  })

  it('the jobs page has the heading, job links and canonical link', () => {
    const html = send(
      renderJobListPage({ heading: 'Open jobs across Africa', description: 'Browse and apply for real jobs across Africa. See the pay and location.', intro: 'Real jobs from employers you can check.', path: '/jobs', jobs, siteUrl: SITE }),
    )
    expect(checkPage(html, { ...expectations.jobs, siteUrl: SITE })).toEqual([])
  })

  it('a job page has JobPosting and breadcrumb data and its own canonical link', () => {
    const html = send(renderJobPage(job(1), SITE))
    expect(checkPage(html, { ...expectations.job('job-1'), siteUrl: SITE })).toEqual([])
  })

  it('FAILS on the thin page that was served before: a heading and one paragraph, no links, canonical or data', () => {
    const thin = '<!doctype html><html><head><title>JobWahala</title></head><body><div id="root"><h1>Work without the wahala</h1><p>Real jobs.</p></div></body></html>'
    const problems = checkPage(thin, { ...expectations.home, siteUrl: SITE }) as string[]
    expect(problems.join('\n')).toMatch(/words of visible text/)
    expect(problems.join('\n')).toMatch(/no canonical link/)
    expect(problems.join('\n')).toMatch(/links to job pages/)
    expect(problems.join('\n')).toMatch(/Organization/)
  })

  it('FAILS when a job page loses its JobPosting data or points its canonical at another page', () => {
    const html = send(renderJobPage(job(1), SITE))
    const noData = html.replace(/<script type="application\/ld\+json">/g, '<script type="text/plain">')
    expect((checkPage(noData, { ...expectations.job('job-1'), siteUrl: SITE }) as string[]).join('\n')).toMatch(/missing JobPosting/)

    const wrongCanonical = html.replace('href="https://www.jobwahala.com/jobs/job-1"', 'href="https://www.jobwahala.com/"')
    expect((checkPage(wrongCanonical, { ...expectations.job('job-1'), siteUrl: SITE }) as string[]).join('\n')).toMatch(/canonical is/)
  })

  it('counts only visible words', () => {
    expect(visibleWords('<head><title>a b c</title></head><body><script>x y z</script><p>one two</p></body>')).toBe(2)
  })
})
