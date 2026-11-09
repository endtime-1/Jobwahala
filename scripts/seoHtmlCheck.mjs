// Checks that public pages are readable WITHOUT JavaScript: the HTML itself must carry the heading, the links,
// the canonical link and the structured data. Used by the live check below and by src/seo/seoHtml.test.ts.
// Live use:  node scripts/seoHtmlCheck.mjs [https://www.jobwahala.com]   (npm run seo:check)

const BASE = 'https://www.jobwahala.com'

export const visibleWords = (html) =>
  html
    .replace(/<(script|style|noscript|template)\b[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<head\b[\s\S]*?<\/head>/i, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z#0-9]+;/gi, ' ')
    .split(/\s+/)
    .filter(Boolean).length

const jsonLdTypes = (html) => {
  const types = []
  for (const match of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    try {
      const data = JSON.parse(match[1])
      for (const item of Array.isArray(data) ? data : [data]) types.push(item['@type'])
    } catch {
      types.push('INVALID_JSON')
    }
  }
  return types
}

const jobLinks = (html) => [...html.matchAll(/<a [^>]*href="(?:https?:\/\/[^"/]+)?\/jobs\/([A-Za-z0-9-]+)"/g)].map((match) => match[1])

/**
 * Returns a list of problems (empty when the page is fine).
 * options: path, minWords, minJobLinks, requireJsonLd (list of @type values), forbidJsonLd, minH2
 */
export const checkPage = (html, { path, minWords = 120, minJobLinks = 0, requireJsonLd = [], forbidJsonLd = [], minH2 = 0, siteUrl = BASE }) => {
  const problems = []
  const h1 = (html.match(/<h1\b/gi) ?? []).length
  if (h1 !== 1) problems.push(`${path}: expected exactly one <h1>, found ${h1}`)

  const words = visibleWords(html)
  if (words < minWords) problems.push(`${path}: only ${words} words of visible text (needs ${minWords})`)

  const h2 = (html.match(/<h2\b/gi) ?? []).length
  if (h2 < minH2) problems.push(`${path}: expected at least ${minH2} <h2> headings, found ${h2}`)

  const canonical = /<link[^>]*rel="canonical"[^>]*href="([^"]+)"/i.exec(html)?.[1] ?? /<link[^>]*href="([^"]+)"[^>]*rel="canonical"/i.exec(html)?.[1]
  if (!canonical) problems.push(`${path}: no canonical link`)
  else if (canonical !== `${siteUrl}${path === '/' ? '/' : path}` && canonical !== `${siteUrl}${path}`) problems.push(`${path}: canonical is ${canonical}`)

  const links = jobLinks(html).length
  if (links < minJobLinks) problems.push(`${path}: expected at least ${minJobLinks} links to job pages, found ${links}`)

  const types = jsonLdTypes(html)
  for (const type of requireJsonLd) if (!types.includes(type)) problems.push(`${path}: missing ${type} structured data (has ${types.join(', ') || 'none'})`)
  for (const type of forbidJsonLd) if (types.includes(type)) problems.push(`${path}: must not have ${type} structured data`)
  if (types.includes('INVALID_JSON')) problems.push(`${path}: structured data is not valid JSON`)

  if (!/<title>[^<]{10,}<\/title>/i.test(html)) problems.push(`${path}: missing or short <title>`)
  if (!/<meta name="description" content="[^"]{30,}"/i.test(html)) problems.push(`${path}: missing or short meta description`)
  return problems
}

/** What each public page must have. */
export const expectations = {
  home: { path: '/', minWords: 150, minJobLinks: 1, minH2: 5, requireJsonLd: ['Organization', 'WebSite'] },
  jobs: { path: '/jobs', minWords: 60, minJobLinks: 1 },
  job: (id) => ({ path: `/jobs/${id}`, minWords: 80, requireJsonLd: ['JobPosting', 'BreadcrumbList'] }),
}

const fetchHtml = async (base, path) => {
  const response = await fetch(`${base}${path}`, { headers: { 'user-agent': 'Mozilla/5.0 (JobWahala SEO check, no JavaScript)', accept: 'text/html' }, redirect: 'follow' })
  return { status: response.status, html: await response.text() }
}

export const runLiveCheck = async (base = BASE) => {
  const problems = []
  const report = []
  const home = await fetchHtml(base, '/')
  const jobs = await fetchHtml(base, '/jobs')
  if (home.status !== 200) problems.push(`/: status ${home.status}`)
  if (jobs.status !== 200) problems.push(`/jobs: status ${jobs.status}`)
  problems.push(...checkPage(home.html, { ...expectations.home, siteUrl: base }), ...checkPage(jobs.html, { ...expectations.jobs, siteUrl: base }))
  report.push(`/ : ${visibleWords(home.html)} words`, `/jobs : ${visibleWords(jobs.html)} words`)

  const jobId = jobLinks(home.html)[0] ?? jobLinks(jobs.html)[0]
  if (!jobId) problems.push('no job page to check: the home page links to no jobs')
  else {
    const job = await fetchHtml(base, `/jobs/${jobId}`)
    if (job.status !== 200) problems.push(`/jobs/${jobId}: status ${job.status}`)
    problems.push(...checkPage(job.html, { ...expectations.job(jobId), siteUrl: base }))
    report.push(`/jobs/${jobId} : ${visibleWords(job.html)} words`)
  }
  return { problems, report }
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/').split('/').pop())) {
  const { problems, report } = await runLiveCheck(process.argv[2] || BASE)
  for (const line of report) console.log(line)
  if (problems.length) {
    console.error(`\n${problems.length} SEO problem(s):\n- ${problems.join('\n- ')}`)
    process.exit(1)
  }
  console.log('OK: the HTML has the heading, job links, canonical link and structured data without JavaScript.')
}
