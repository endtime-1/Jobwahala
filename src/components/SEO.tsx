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
  description = 'JobWahala connects talent and employers across Africa. Find jobs, hire freelancers and get paid safely, with payments held in escrow until the work is approved.',
  canonical = 'https://jobwahala.com',
  ogImage = 'https://jobwahala.com/og-image.jpg',
  ogType = 'website',
  keywords = 'jobs in africa, freelance africa, remote work africa, hire freelancers africa, escrow payments, mobile money, jobwahala'
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
