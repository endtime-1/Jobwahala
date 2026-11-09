import { Helmet } from 'react-helmet-async'

interface SEOProps {
  title?: string
  description?: string
  canonical?: string
  ogImage?: string
  ogType?: 'website' | 'article' | 'profile'
  keywords?: string
  /** Ask search engines to leave this page out of their results. */
  noindex?: boolean
}

const SITE = 'https://www.jobwahala.com'

/** This page's own address on the main site: the canonical link must never point at another page. */
const currentCanonical = () => {
  const path = typeof window === 'undefined' ? '/' : window.location.pathname
  return `${SITE}${path === '/' ? '' : path.replace(/\/+$/, '')}`
}

export default function SEO({
  title,
  description = 'Find real jobs across Africa from employers you can check, or post your jobs free and review applicants on one board.',
  canonical = currentCanonical(),
  ogImage = 'https://www.jobwahala.com/og-image.jpg',
  ogType = 'website',
  keywords = 'jobs in africa, jobs in ghana, remote work africa, post a job free, verified employers, jobwahala',
  noindex = false,
}: SEOProps) {
  const siteTitle = 'JobWahala'
  const fullTitle = title ? `${title} | ${siteTitle}` : `${siteTitle} — Real jobs across Africa`

  return (
    <Helmet>
      {/* Basic Meta Tags */}
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <meta name="keywords" content={keywords} />
      <link rel="canonical" href={canonical} />
      {noindex ? <meta name="robots" content="noindex, follow" /> : null}

      {/* Open Graph / Facebook */}
      <meta property="og:type" content={ogType} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={ogImage} />
      <meta property="og:url" content={canonical} />

      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={ogImage} />
    </Helmet>
  )
}
