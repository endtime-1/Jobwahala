import { Helmet } from 'react-helmet-async'

interface SEOProps {
  title?: string
  description?: string
  canonical?: string
  ogImage?: string
  ogType?: 'website' | 'article' | 'profile'
  keywords?: string
}

export default function SEO({
  title,
  description = "JobWahala — Africa's Elite Talent Workspace. Connecting Ghana's top tech professionals with global high-growth opportunities.",
  canonical = 'https://jobwahala.com',
  ogImage = 'https://jobwahala.com/og-image.png',
  ogType = 'website',
  keywords = 'jobs in ghana, freelance accra, remote work ghana, hire software engineers ghana, tech talent ghana, jobwahala'
}: SEOProps) {
  const siteTitle = 'JobWahala'
  const fullTitle = title ? `${title} | ${siteTitle}` : `${siteTitle} — Africa's Elite Talent Platform`

  return (
    <Helmet>
      {/* Basic Meta Tags */}
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <meta name="keywords" content={keywords} />
      <link rel="canonical" href={canonical} />

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
