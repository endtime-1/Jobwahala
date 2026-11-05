import { renderShell } from './seoPages';
import { escapeHtml as e } from './sharePage';
import { skillName } from '../content/skills';
import {
  buildCourseJsonLd,
  categoryName,
  durationText,
  formatLabel,
  levelLabel,
  priceLabel,
  upcomingStartDates,
  type CourseLanding,
  type PublicCourse,
} from './courses';

/** Plain HTML versions of the course pages, for search engines and link previews. */

const courseItem = (course: PublicCourse, siteUrl: string) => {
  const facts = [priceLabel(course), durationText(course.durationWeeks), formatLabel(course.format), course.location, levelLabel(course.level)].filter(Boolean).join(' · ');
  return `<li><a href="${e(`${siteUrl}/courses/${course.slug}`)}">${e(course.title)}</a> - ${e(course.provider.name)} (${e(facts)})</li>`;
};

const breadcrumbJsonLd = (siteUrl: string, trail: { label: string; path: string }[]) => ({
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: trail.map((crumb, index) => ({ '@type': 'ListItem', position: index + 1, name: crumb.label, item: `${siteUrl}${crumb.path}` })),
});

export const renderCourseDetailPage = (course: PublicCourse & { description: string }, siteUrl: string) => {
  const url = `${siteUrl}/courses/${course.slug}`;
  const starts = upcomingStartDates(course.startDates);
  const facts = [
    ['Price', priceLabel(course)],
    ['Duration', durationText(course.durationWeeks)],
    ['Format', `${formatLabel(course.format)}${course.location ? ` (${course.location})` : ''}`],
    ['Level', levelLabel(course.level)],
    ['Starts', course.rollingStart ? 'Any time' : starts.join(', ')],
    ['Certificate', course.certificateOffered ? 'Offered' : ''],
  ].filter(([, value]) => value);

  const description = `${course.title} by ${course.provider.name}. ${priceLabel(course)}${course.durationWeeks ? `, ${durationText(course.durationWeeks)}` : ''}, ${formatLabel(course.format).toLowerCase()}. ${course.summary}`.slice(0, 200);

  return renderShell({
    title: `${course.title} - ${course.provider.name}`,
    description,
    url,
    siteUrl,
    ogType: 'article',
    image: course.provider.logoUrl && /^https?:\/\//i.test(course.provider.logoUrl) && !/\.svg(\?|$)/i.test(course.provider.logoUrl) ? { url: course.provider.logoUrl, alt: `${course.provider.name} logo` } : undefined,
    jsonLd: [
      buildCourseJsonLd(course, siteUrl),
      breadcrumbJsonLd(siteUrl, [
        { label: 'Home', path: '/' },
        { label: 'Courses', path: '/courses' },
        { label: categoryName(course.category), path: `/courses/category/${course.category}` },
        { label: course.title, path: `/courses/${course.slug}` },
      ]),
    ],
    body: `<h1>${e(course.title)}</h1>
<p>${e(course.provider.name)}${course.provider.isVerified ? ' (verified provider)' : ''}</p>
<p>${e(course.summary)}</p>
<ul>
${facts.map(([label, value]) => `<li>${e(label)}: ${e(value)}</li>`).join('\n')}
</ul>
${course.skills.length ? `<p>Skills you learn: ${course.skills.map((skill) => e(skillName(skill))).join(', ')}</p>` : ''}
${course.description
  .split(/\n+/)
  .map((line) => line.trim())
  .filter(Boolean)
  .map((line) => `<p>${e(line)}</p>`)
  .join('')}
<p><a href="${e(url)}">See this course on JobWahala</a></p>`,
  });
};

export const renderCourseLandingPage = (page: CourseLanding, siteUrl: string) =>
  renderShell({
    title: page.title,
    description: page.description,
    url: `${siteUrl}${page.path}`,
    siteUrl,
    noindex: !page.indexable,
    jsonLd: [
      breadcrumbJsonLd(siteUrl, [
        { label: 'Home', path: '/' },
        { label: 'Courses', path: '/courses' },
        { label: page.h1, path: page.path },
      ]),
      ...(page.courses.length
        ? [
            {
              '@context': 'https://schema.org',
              '@type': 'ItemList',
              itemListElement: page.courses.map((course, index) => ({ '@type': 'ListItem', position: index + 1, url: `${siteUrl}/courses/${course.slug}`, name: course.title })),
            },
          ]
        : []),
    ],
    body: `<h1>${e(page.h1)}</h1>
<p>${e(page.intro)}</p>
${page.courses.length ? `<ul>\n${page.courses.map((course) => courseItem(course, siteUrl)).join('\n')}\n</ul>` : '<p>No courses are listed right now. Check back soon.</p>'}
${page.related.length ? `<section><h2>Related courses</h2><ul>\n${page.related.map((link) => `<li><a href="${e(`${siteUrl}${link.path}`)}">${e(link.label)}</a> (${link.count})</li>`).join('\n')}\n</ul></section>` : ''}
<p><a href="${e(siteUrl)}/courses">Browse every course</a></p>`,
  });

export const renderCourseHubPage = (courses: PublicCourse[], siteUrl: string) =>
  renderShell({
    title: 'Courses and training in Ghana',
    description: 'Find courses from training providers in Ghana. Compare price, duration, format and start dates, then enquire. Free courses and verified providers.',
    url: `${siteUrl}/courses`,
    siteUrl,
    noindex: courses.length === 0,
    jsonLd: breadcrumbJsonLd(siteUrl, [{ label: 'Home', path: '/' }, { label: 'Courses', path: '/courses' }]),
    body: `<h1>Courses and training in Ghana</h1>
<p>Learn a skill employers ask for. Compare courses from training providers, see the price and start date, then enquire.</p>
${courses.length ? `<ul>\n${courses.slice(0, 50).map((course) => courseItem(course, siteUrl)).join('\n')}\n</ul>` : '<p>No courses are listed right now. Check back soon.</p>'}`,
  });
