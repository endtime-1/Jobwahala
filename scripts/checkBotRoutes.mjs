// Requests the key public pages as Googlebot (smartphone and desktop) and as a normal browser, on the www and bare domains.
// Fails (exit 1) when a page that must work answers anything but 200, or when the rules for missing pages and the
// bare domain are broken.   Usage: node scripts/checkBotRoutes.mjs [https://www.jobwahala.com] [https://jobwahala.com]
const main = (process.argv[2] || process.env.SITE_URL || 'https://www.jobwahala.com').replace(/\/$/, '')
const bare = (process.argv[3] || process.env.BARE_URL || '').replace(/\/$/, '')

const agents = {
  'Googlebot smartphone':
    'Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Mobile Safari/537.36 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
  'Googlebot desktop': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
  'Google-InspectionTool': 'Mozilla/5.0 (compatible; Google-InspectionTool/1.0)',
  Browser: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
}

const mustBe200 = ['/', '/jobs', '/internships', '/courses', '/jobs-in/ghana', '/jobs-by-location', '/terms', '/privacy', '/blog', '/robots.txt', '/sitemap.xml']
const failures = []
const ask = (url, userAgent, init = {}) => fetch(url, { redirect: 'manual', headers: { 'User-Agent': userAgent, Accept: 'text/html,*/*' }, ...init })

for (const [name, userAgent] of Object.entries(agents)) {
  for (const path of mustBe200) {
    const response = await ask(main + path, userAgent)
    const ok = response.status === 200
    console.log(`${ok ? 'ok  ' : 'FAIL'} ${response.status} ${name.padEnd(22)} ${path}`)
    if (!ok) failures.push(`${name} ${path} -> ${response.status}`)
  }
}

// A job listed in the sitemap must answer 200 to a bot.
const sitemap = await (await ask(`${main}/sitemap.xml`, agents['Googlebot desktop'])).text()
const firstJob = [...sitemap.matchAll(/<loc>([^<]*\/jobs\/[^<]+)<\/loc>/g)][0]?.[1]
if (firstJob) {
  const path = new URL(firstJob).pathname
  const response = await ask(main + path, agents['Googlebot smartphone'])
  console.log(`${response.status === 200 ? 'ok  ' : 'FAIL'} ${response.status} job page from the sitemap   ${path}`)
  if (response.status !== 200) failures.push(`job page ${path} -> ${response.status}`)
}
if (/<loc>https?:\/\/(?!www\.)/.test(sitemap)) failures.push('the sitemap lists addresses that are not on www')

// Missing pages are real 404s.
for (const path of ['/nope-xyz-123', '/jobs/does-not-exist-000', '/assets/missing.js']) {
  const response = await ask(main + path, agents['Googlebot smartphone'])
  const ok = response.status === 404 || response.status === 410
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${response.status} missing page should be 404 ${path}`)
  if (!ok) failures.push(`missing page ${path} -> ${response.status}`)
}

// The bare domain goes to www.
if (bare) {
  const response = await ask(`${bare}/jobs`, agents['Googlebot smartphone'])
  const ok = response.status === 301 && (response.headers.get('location') || '').startsWith(main)
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${response.status} ${bare}/jobs -> ${response.headers.get('location')}`)
  if (!ok) failures.push('the bare domain does not 301 to www')
}

if (failures.length) {
  console.error(`\n${failures.length} problem(s):\n- ${failures.join('\n- ')}`)
  process.exit(1)
}
console.log('\nAll bot checks passed.')
