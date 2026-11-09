/**
 * Search landing pages, made from the live jobs: "Jobs in Accra", "Banking jobs", "Banking jobs in Accra",
 * "Part-time jobs", "Internship jobs in Kumasi" and so on.
 *
 * A page is published (indexed, and in the sitemap) only when it has at least MIN_JOBS open jobs. Pages with
 * fewer still work for people, but tell search engines not to index them.
 */

export const MIN_JOBS = 3;
const PAGE_JOB_LIMIT = 50;
const RELATED_LIMIT = 8;

export type LandingJob = {
  id: string;
  title: string;
  location?: string | null;
  type: string;
  category?: string | null;
  salary?: string | null;
  salaryMin?: number | null;
  createdAt: Date | string;
  employerName: string;
};

// ---------------------------------------------------------------- places

type Region = { slug: string; name: string; /** names that identify it on their own */ aliases: string[] };
type City = { name: string; region: string };

const REGIONS: Region[] = [
  { slug: 'greater-accra-region', name: 'Greater Accra', aliases: ['greater accra'] },
  { slug: 'ashanti-region', name: 'Ashanti', aliases: ['ashanti'] },
  { slug: 'western-region', name: 'Western', aliases: ['western region'] },
  { slug: 'western-north-region', name: 'Western North', aliases: ['western north'] },
  { slug: 'central-region', name: 'Central', aliases: ['central region'] },
  { slug: 'eastern-region', name: 'Eastern', aliases: ['eastern region'] },
  { slug: 'volta-region', name: 'Volta', aliases: ['volta'] },
  { slug: 'oti-region', name: 'Oti', aliases: ['oti region'] },
  { slug: 'northern-region', name: 'Northern', aliases: ['northern region'] },
  { slug: 'savannah-region', name: 'Savannah', aliases: ['savannah region'] },
  { slug: 'north-east-region', name: 'North East', aliases: ['north east region'] },
  { slug: 'upper-east-region', name: 'Upper East', aliases: ['upper east'] },
  { slug: 'upper-west-region', name: 'Upper West', aliases: ['upper west'] },
  { slug: 'bono-region', name: 'Bono', aliases: ['bono region'] },
  { slug: 'bono-east-region', name: 'Bono East', aliases: ['bono east'] },
  { slug: 'ahafo-region', name: 'Ahafo', aliases: ['ahafo'] },
];

const CITIES: City[] = [
  { name: 'Accra', region: 'greater-accra-region' },
  { name: 'Tema', region: 'greater-accra-region' },
  { name: 'Madina', region: 'greater-accra-region' },
  { name: 'Adenta', region: 'greater-accra-region' },
  { name: 'Kasoa', region: 'central-region' },
  { name: 'Cape Coast', region: 'central-region' },
  { name: 'Winneba', region: 'central-region' },
  { name: 'Elmina', region: 'central-region' },
  { name: 'Kumasi', region: 'ashanti-region' },
  { name: 'Obuasi', region: 'ashanti-region' },
  { name: 'Ejisu', region: 'ashanti-region' },
  { name: 'Konongo', region: 'ashanti-region' },
  { name: 'Takoradi', region: 'western-region' },
  { name: 'Sekondi', region: 'western-region' },
  { name: 'Tarkwa', region: 'western-region' },
  { name: 'Sefwi Wiawso', region: 'western-north-region' },
  { name: 'Koforidua', region: 'eastern-region' },
  { name: 'Nsawam', region: 'eastern-region' },
  { name: 'Akosombo', region: 'eastern-region' },
  { name: 'Ho', region: 'volta-region' },
  { name: 'Hohoe', region: 'volta-region' },
  { name: 'Aflao', region: 'volta-region' },
  { name: 'Keta', region: 'volta-region' },
  { name: 'Dambai', region: 'oti-region' },
  { name: 'Tamale', region: 'northern-region' },
  { name: 'Yendi', region: 'northern-region' },
  { name: 'Damongo', region: 'savannah-region' },
  { name: 'Nalerigu', region: 'north-east-region' },
  { name: 'Bolgatanga', region: 'upper-east-region' },
  { name: 'Bawku', region: 'upper-east-region' },
  { name: 'Navrongo', region: 'upper-east-region' },
  { name: 'Wa', region: 'upper-west-region' },
  { name: 'Sunyani', region: 'bono-region' },
  { name: 'Berekum', region: 'bono-region' },
  { name: 'Techiman', region: 'bono-east-region' },
  { name: 'Kintampo', region: 'bono-east-region' },
  { name: 'Goaso', region: 'ahafo-region' },
];

export const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Is this word (or phrase) in the text as a whole word? "Ho" is in "Ho, Volta" but not in "Hotel". */
export const mentions = (text: string | null | undefined, name: string) =>
  new RegExp(`(?<![a-z0-9])${escapeRegex(name.toLowerCase())}(?![a-z0-9])`).test((text ?? '').toLowerCase());

type Place = { slug: string; name: string; kind: 'city' | 'region' };

const cityPlace = (city: City): Place => ({ slug: slugify(city.name), name: city.name, kind: 'city' });
const regionPlace = (region: Region): Place => ({ slug: region.slug, name: `${region.name} Region`, kind: 'region' });

const STATIC_PLACES = new Map<string, Place>([...CITIES.map(cityPlace), ...REGIONS.map(regionPlace)].map((place) => [place.slug, place]));

const NOT_A_CITY = new Set(['ghana', 'africa', 'remote', 'hybrid', 'onsite', 'on site', 'on-site', 'nationwide', 'nigeria', 'kenya', 'south africa', 'rwanda', 'senegal', 'tanzania', 'uganda', 'ethiopia', 'egypt', 'anywhere']);

/** The places a job is in: its towns and the regions they belong to. */
export const placesOfJob = (job: Pick<LandingJob, 'location'>): Place[] => {
  const location = job.location ?? '';
  const places = new Map<string, Place>();

  for (const city of CITIES) {
    if (!mentions(location, city.name)) continue;
    const place = cityPlace(city);
    places.set(place.slug, place);
    const region = REGIONS.find((item) => item.slug === city.region);
    if (region) places.set(region.slug, regionPlace(region));
  }
  for (const region of REGIONS) {
    if (region.aliases.some((alias) => mentions(location, alias))) places.set(region.slug, regionPlace(region));
  }

  // A town we have no page for yet ("Spintex, Accra" still counts as Accra; "Techiman Road" counts as Techiman).
  const hasCity = [...places.values()].some((place) => place.kind === 'city');
  if (!hasCity) {
    const first = location.split(/[,/(]/)[0].trim();
    const slug = slugify(first);
    if (first && first.length <= 40 && !/\d/.test(first) && !NOT_A_CITY.has(first.toLowerCase()) && slug) {
      places.set(slug, { slug, name: first.replace(/\s+/g, ' '), kind: 'city' });
    }
  }
  return [...places.values()];
};

// ------------------------------------------------------------ categories

type Category = { slug: string; name: string; keywords: string[] };

// A keyword matches words that START with it ("bank" finds banking and banker); a trailing ! means the whole word.
export const CATEGORIES: Category[] = [
  { slug: 'banking', name: 'Banking', keywords: ['bank', 'teller', 'loan officer', 'microfinance', 'credit officer'] },
  { slug: 'accounting', name: 'Accounting', keywords: ['account', 'audit', 'bookkeep', 'tax'] },
  { slug: 'finance', name: 'Finance', keywords: ['financ', 'treasury', 'investment'] },
  { slug: 'sales', name: 'Sales', keywords: ['sales', 'business development'] },
  { slug: 'marketing', name: 'Marketing', keywords: ['marketing', 'brand', 'social media'] },
  { slug: 'customer-service', name: 'Customer service', keywords: ['customer', 'call cent'] },
  { slug: 'technology', name: 'Technology', keywords: ['technolog', 'software', 'developer', 'programm', 'devops', 'cyber', 'it support', 'data'] },
  { slug: 'education', name: 'Education', keywords: ['educat', 'teach', 'tutor', 'lecturer', 'school'] },
  { slug: 'healthcare', name: 'Healthcare', keywords: ['health', 'nurs', 'pharmac', 'clinic', 'medical', 'doctor', 'hospital'] },
  { slug: 'hospitality', name: 'Hospitality', keywords: ['hospitality', 'hotel', 'restaurant', 'chef', 'cook', 'waiter', 'housekeep'] },
  { slug: 'logistics', name: 'Logistics', keywords: ['logistic', 'driver', 'delivery', 'warehouse', 'supply chain', 'dispatch'] },
  { slug: 'agriculture', name: 'Agriculture', keywords: ['agricultur', 'farm', 'agribusiness', 'agronom'] },
  { slug: 'design', name: 'Design', keywords: ['design', 'graphic'] },
  { slug: 'engineering', name: 'Engineering', keywords: ['engineer'] },
  { slug: 'administration', name: 'Administration', keywords: ['admin', 'secretar', 'office assist', 'clerk', 'receptionist'] },
  { slug: 'human-resources', name: 'Human resources', keywords: ['human resource', 'recruit', 'payroll', 'hr!'] },
  { slug: 'security', name: 'Security', keywords: ['security', 'guard'] },
  { slug: 'construction', name: 'Construction', keywords: ['construct', 'mason', 'carpent', 'electrician', 'plumb', 'architect'] },
  { slug: 'retail', name: 'Retail', keywords: ['retail', 'cashier', 'shop', 'store'] },
  { slug: 'legal', name: 'Legal', keywords: ['legal', 'lawyer', 'law!', 'paralegal', 'compliance'] },
  { slug: 'media', name: 'Media', keywords: ['media', 'journalis', 'photograph', 'video', 'editor'] },
];

const keywordMatches = (text: string, keyword: string) => {
  const whole = keyword.endsWith('!');
  const word = whole ? keyword.slice(0, -1) : keyword;
  return new RegExp(`(?<![a-z0-9])${escapeRegex(word)}${whole ? '(?![a-z0-9])' : ''}`).test(text);
};

export const categoriesOfJob = (job: Pick<LandingJob, 'title' | 'category'>): Category[] => {
  const category = (job.category ?? '').toLowerCase();
  const title = job.title.toLowerCase();
  return CATEGORIES.filter((entry) => entry.keywords.some((keyword) => keywordMatches(category, keyword) || keywordMatches(title, keyword)));
};

// ----------------------------------------------------------------- types

type TypeDef = {
  slug: string;
  /** "Part-time jobs" */
  heading: string;
  /** used inside sentences: "part-time jobs" */
  noun: string;
  matches: (job: Pick<LandingJob, 'type' | 'location'>) => boolean;
};

const sameType = (a: string, b: string) => a.trim().toLowerCase() === b.toLowerCase();

const TYPES: TypeDef[] = [
  { slug: 'part-time', heading: 'Part-time jobs', noun: 'part-time jobs', matches: (job) => sameType(job.type, 'Part-time') },
  { slug: 'full-time', heading: 'Full-time jobs', noun: 'full-time jobs', matches: (job) => sameType(job.type, 'Full-time') },
  { slug: 'contract', heading: 'Contract jobs', noun: 'contract jobs', matches: (job) => sameType(job.type, 'Contract') },
  { slug: 'remote', heading: 'Remote jobs', noun: 'remote jobs', matches: (job) => mentions(job.location, 'remote') },
  { slug: 'internship', heading: 'Internships', noun: 'internships', matches: (job) => sameType(job.type, 'Internship') },
  { slug: 'nss', heading: 'National Service (NSS) jobs', noun: 'National Service (NSS) placements', matches: (job) => sameType(job.type, 'National Service (NSS)') },
  { slug: 'attachment', heading: 'Industrial attachments', noun: 'industrial attachments', matches: (job) => sameType(job.type, 'Industrial Attachment') },
  { slug: 'fresher', heading: 'Fresher and entry-level jobs', noun: 'fresher and entry-level jobs', matches: (job) => sameType(job.type, 'Graduate / Entry-level Job') },
];

export const typesOfJob = (job: Pick<LandingJob, 'type' | 'location'>) => TYPES.filter((entry) => entry.matches(job));

// ----------------------------------------------------------------- pages

export type PageSpec = {
  kind: 'place' | 'category' | 'type' | 'category-place' | 'type-place';
  place?: Place;
  category?: Category;
  type?: TypeDef;
};

export type LandingIndex = Map<string, { spec: PageSpec; jobs: LandingJob[] }>;

const slugFor = (spec: PageSpec) => {
  const place = spec.place ? `-in-${spec.place.slug}` : '';
  if (spec.category) return `${spec.category.slug}-jobs${place}`;
  if (spec.type) return `${spec.type.slug}-jobs${place}`;
  return `jobs${place}`;
};

/** Sorts every live job into every page it belongs to. */
export const buildLandingIndex = (jobs: LandingJob[]): LandingIndex => {
  const index: LandingIndex = new Map();
  const add = (spec: PageSpec, job: LandingJob) => {
    const slug = slugFor(spec);
    const entry = index.get(slug);
    if (entry) entry.jobs.push(job);
    else index.set(slug, { spec, jobs: [job] });
  };
  const kinds = new Set([...CATEGORIES.map((c) => c.slug), ...TYPES.map((t) => t.slug)]);

  for (const job of jobs) {
    const places = placesOfJob(job).filter((place) => !kinds.has(place.slug));
    const categories = categoriesOfJob(job);
    const types = typesOfJob(job);

    for (const place of places) add({ kind: 'place', place }, job);
    for (const category of categories) {
      add({ kind: 'category', category }, job);
      for (const place of places) add({ kind: 'category-place', category, place }, job);
    }
    for (const type of types) {
      add({ kind: 'type', type }, job);
      for (const place of places) add({ kind: 'type-place', type, place }, job);
    }
  }
  return index;
};

/** A page we know how to make even when it has no jobs yet ("jobs-in-kumasi" before anyone posts in Kumasi). */
const parseStaticSlug = (slug: string): PageSpec | null => {
  const place = (value: string) => STATIC_PLACES.get(value);
  const left = (value: string) => ({
    category: CATEGORIES.find((entry) => entry.slug === value),
    type: TYPES.find((entry) => entry.slug === value),
  });

  const onlyPlace = /^jobs-in-(.+)$/.exec(slug);
  if (onlyPlace) {
    const found = place(onlyPlace[1]);
    return found ? { kind: 'place', place: found } : null;
  }

  const combo = /^(.+?)-jobs-in-(.+)$/.exec(slug);
  if (combo) {
    const found = place(combo[2]);
    const { category, type } = left(combo[1]);
    if (!found) return null;
    if (category) return { kind: 'category-place', category, place: found };
    if (type) return { kind: 'type-place', type, place: found };
    return null;
  }

  const single = /^(.+)-jobs$/.exec(slug);
  if (single) {
    const { category, type } = left(single[1]);
    if (category) return { kind: 'category', category };
    if (type) return { kind: 'type', type };
  }
  return null;
};

export type RelatedLink = { label: string; path: string; count: number };
export type RelatedGroup = { title: string; links: RelatedLink[] };

export type LandingPage = {
  slug: string;
  path: string;
  kind: PageSpec['kind'] | 'directory';
  h1: string;
  title: string;
  description: string;
  intro: string;
  count: number;
  /** False when there are fewer than MIN_JOBS open jobs: the page must say noindex and stay out of the sitemap. */
  indexable: boolean;
  jobs: LandingJob[];
  related: RelatedGroup[];
  breadcrumbs: { label: string; path: string }[];
};

const capitalise = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

const names = (spec: PageSpec) => {
  const where = spec.place ? ` in ${spec.place.name}` : '';
  if (spec.category) return { h1: `${spec.category.name} jobs${where}`, noun: `${spec.category.name.toLowerCase()} jobs${where}` };
  if (spec.type) return { h1: `${spec.type.heading}${where}`, noun: `${spec.type.noun}${where}` };
  return { h1: `Jobs${where}`, noun: `jobs${where}` };
};

const sortedByNewest = (jobs: LandingJob[]) => [...jobs].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

const listWords = (items: string[]) => (items.length <= 1 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`);

const topBy = (jobs: LandingJob[], pick: (job: LandingJob) => string[], limit: number) => {
  const counts = new Map<string, number>();
  for (const job of jobs) for (const key of new Set(pick(job))) counts.set(key, (counts.get(key) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, limit).map(([key]) => key);
};

const describe = (spec: PageSpec, jobs: LandingJob[]) => {
  const { h1, noun } = names(spec);
  const count = jobs.length;

  if (count === 0) {
    return {
      title: h1,
      description: `Find ${noun} on JobWahala. There are none open right now, but new jobs are added every day. Save an alert and we will email you.`,
      intro: `There are no open ${noun} on JobWahala right now. New jobs are added every day: browse every open job, or save an alert and we will tell you when one is posted.`,
    };
  }

  const employers = new Set(jobs.map((job) => job.employerName)).size;
  const topCategories = spec.category ? [] : topBy(jobs, (job) => categoriesOfJob(job).map((c) => c.name), 2);
  const topPlaces = spec.place ? [] : topBy(jobs, (job) => placesOfJob(job).filter((p) => p.kind === 'city').map((p) => p.name), 3);
  const pays = jobs.map((job) => job.salaryMin).filter((value): value is number => typeof value === 'number' && value > 0);

  const bits = [
    count === 1
      ? `There is 1 open job matching ${noun} on JobWahala, from 1 employer.`
      : `There are ${count} open ${noun} on JobWahala from ${employers} ${employers === 1 ? 'employer' : 'employers'}.`,
    topCategories.length ? `Most are in ${listWords(topCategories)}.` : '',
    topPlaces.length ? `Jobs are open in ${listWords(topPlaces)}.` : '',
    pays.length ? `Pay starts from GHS ${Math.min(...pays).toLocaleString('en-GB')} a month on the jobs that list it.` : '',
    'See the pay and location before you apply.',
  ].filter(Boolean);

  return {
    // City pages say how many vacancies there are; a category on its own says it is for Ghana.
    title: spec.category && !spec.place ? `${h1} in Ghana` : `${h1} - ${count} ${count === 1 ? 'vacancy' : 'vacancies'} today`,
    description: `Apply for ${count} open ${noun}${topCategories.length ? `, mostly ${listWords(topCategories)}` : ''}. See the pay and location before you apply on JobWahala.`.slice(0, 200),
    intro: bits.join(' '),
  };
};

const pathOf = (slug: string) => `/${slug}`;

/** Pages with enough jobs to be published. */
export const indexablePages = (index: LandingIndex) =>
  [...index.entries()].filter(([, entry]) => entry.jobs.length >= MIN_JOBS).map(([slug, entry]) => ({ slug, spec: entry.spec, count: entry.jobs.length }));

const labelFor = (spec: PageSpec) => capitalise(names(spec).h1);

const linksFrom = (pages: ReturnType<typeof indexablePages>, keep: (spec: PageSpec) => boolean, exclude: string, limit = RELATED_LIMIT): RelatedLink[] =>
  pages
    .filter((page) => page.slug !== exclude && keep(page.spec))
    .sort((a, b) => b.count - a.count || a.slug.localeCompare(b.slug))
    .slice(0, limit)
    .map((page) => ({ label: labelFor(page.spec), path: pathOf(page.slug), count: page.count }));

const relatedFor = (spec: PageSpec, slug: string, index: LandingIndex): RelatedGroup[] => {
  const pages = indexablePages(index);
  const placeName = spec.place?.name ?? '';
  const groups: RelatedGroup[] = [];
  const add = (title: string, links: RelatedLink[]) => {
    if (links.length > 0) groups.push({ title, links });
  };

  switch (spec.kind) {
    case 'place':
      add(`Jobs in ${placeName} by category`, linksFrom(pages, (s) => s.kind === 'category-place' && s.place?.slug === spec.place?.slug, slug));
      add(`Types of work in ${placeName}`, linksFrom(pages, (s) => s.kind === 'type-place' && s.place?.slug === spec.place?.slug, slug));
      add('Jobs in other places', linksFrom(pages, (s) => s.kind === 'place' && s.place?.slug !== spec.place?.slug && s.place?.kind === spec.place?.kind, slug));
      break;
    case 'category':
      add(`${spec.category!.name} jobs by place`, linksFrom(pages, (s) => s.kind === 'category-place' && s.category?.slug === spec.category?.slug, slug));
      add('Other job categories', linksFrom(pages, (s) => s.kind === 'category' && s.category?.slug !== spec.category?.slug, slug));
      break;
    case 'type':
      add(`${spec.type!.heading} by place`, linksFrom(pages, (s) => s.kind === 'type-place' && s.type?.slug === spec.type?.slug, slug));
      add('Other types of work', linksFrom(pages, (s) => s.kind === 'type' && s.type?.slug !== spec.type?.slug, slug));
      break;
    case 'category-place':
      add(`${spec.category!.name} jobs elsewhere`, linksFrom(pages, (s) => s.kind === 'category-place' && s.category?.slug === spec.category?.slug, slug));
      add(`Other jobs in ${placeName}`, linksFrom(pages, (s) => s.kind === 'category-place' && s.place?.slug === spec.place?.slug, slug));
      add('Broader searches', linksFrom(pages, (s) => (s.kind === 'category' && s.category?.slug === spec.category?.slug) || (s.kind === 'place' && s.place?.slug === spec.place?.slug), slug));
      break;
    case 'type-place':
      add(`${spec.type!.heading} elsewhere`, linksFrom(pages, (s) => s.kind === 'type-place' && s.type?.slug === spec.type?.slug, slug));
      add(`Other work in ${placeName}`, linksFrom(pages, (s) => s.kind === 'type-place' && s.place?.slug === spec.place?.slug, slug));
      add('Broader searches', linksFrom(pages, (s) => (s.kind === 'type' && s.type?.slug === spec.type?.slug) || (s.kind === 'place' && s.place?.slug === spec.place?.slug), slug));
      break;
  }
  return groups;
};

const breadcrumbsFor = (spec: PageSpec, slug: string) => {
  const trail = [{ label: 'Home', path: '/' }, { label: 'Jobs', path: '/jobs' }];
  if (spec.kind === 'place') trail.push({ label: 'Jobs by location', path: '/jobs-by-location' });
  else if (spec.kind === 'category') trail.push({ label: 'Jobs by category', path: '/jobs-by-category' });
  else if (spec.kind === 'category-place') trail.push({ label: `${spec.category!.name} jobs`, path: pathOf(`${spec.category!.slug}-jobs`) });
  else if (spec.kind === 'type-place') trail.push({ label: spec.type!.heading, path: pathOf(`${spec.type!.slug}-jobs`) });
  trail.push({ label: labelFor(spec), path: pathOf(slug) });
  return trail;
};

export const isDirectorySlug = (slug: string) => slug === 'jobs-by-location' || slug === 'jobs-by-category';

/** The page for an address, or null when there is no such page (a real 404). */
export const buildLandingPage = (slug: string, index: LandingIndex): LandingPage | null => {
  if (isDirectorySlug(slug)) return buildDirectoryPage(slug, index);

  const entry = index.get(slug);
  const spec = entry?.spec ?? parseStaticSlug(slug);
  if (!spec) return null;

  const jobs = entry?.jobs ?? [];
  const shown = sortedByNewest(jobs).slice(0, PAGE_JOB_LIMIT);
  const { h1 } = names(spec);

  return {
    slug,
    path: pathOf(slug),
    kind: spec.kind,
    h1: capitalise(h1),
    ...describe(spec, jobs),
    count: jobs.length,
    indexable: jobs.length >= MIN_JOBS,
    jobs: shown,
    related: relatedFor(spec, slug, index),
    breadcrumbs: breadcrumbsFor(spec, slug),
  };
};

const buildDirectoryPage = (slug: string, index: LandingIndex): LandingPage => {
  const pages = indexablePages(index);
  const byPlace = slug === 'jobs-by-location';
  const all = (keep: (spec: PageSpec) => boolean): RelatedLink[] => linksFrom(pages, keep, '', Number.MAX_SAFE_INTEGER);

  const related: RelatedGroup[] = byPlace
    ? [
        { title: 'Regions', links: all((s) => s.kind === 'place' && s.place?.kind === 'region') },
        { title: 'Cities and towns', links: all((s) => s.kind === 'place' && s.place?.kind === 'city') },
      ]
    : [
        { title: 'Job categories', links: all((s) => s.kind === 'category') },
        { title: 'Types of work', links: all((s) => s.kind === 'type') },
      ];
  const groups = related.filter((group) => group.links.length > 0);
  const total = groups.reduce((sum, group) => sum + group.links.length, 0);

  return {
    slug,
    path: pathOf(slug),
    kind: 'directory',
    h1: byPlace ? 'Jobs by location' : 'Jobs by category',
    title: byPlace ? 'Jobs by location in Ghana and Africa' : 'Jobs by category and type of work',
    description: byPlace
      ? 'Browse open jobs by region, city and town. Pick a place to see every open job there, with the pay and location up front.'
      : 'Browse open jobs by category and type of work: banking, sales, teaching, part-time, remote, internships and more.',
    intro: byPlace
      ? 'Pick a region, city or town to see the jobs open there. Places are listed when they have at least three open jobs.'
      : 'Pick a category or type of work to see the jobs open now. Pages appear here once they have at least three open jobs.',
    count: total,
    indexable: total > 0,
    jobs: [],
    related: groups,
    breadcrumbs: [
      { label: 'Home', path: '/' },
      { label: 'Jobs', path: '/jobs' },
      { label: byPlace ? 'Jobs by location' : 'Jobs by category', path: pathOf(slug) },
    ],
  };
};

/** Addresses for the sitemap: every published page, and the directories that have something to list. */
export const landingSitemapPaths = (index: LandingIndex) => {
  const paths = indexablePages(index).map((page) => pathOf(page.slug));
  for (const slug of ['jobs-by-location', 'jobs-by-category']) {
    if (buildDirectoryPage(slug, index).indexable) paths.push(pathOf(slug));
  }
  return paths.sort();
};

/** Does this address look like one of ours? (Lets the web app skip the lookup for anything else.) */
export const looksLikeLandingSlug = (slug: string) =>
  isDirectorySlug(slug) || /^jobs-in-[a-z0-9-]+$/.test(slug) || /^[a-z0-9-]+-jobs$/.test(slug) || /^[a-z0-9-]+-jobs-in-[a-z0-9-]+$/.test(slug);
