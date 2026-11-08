/** The JobWahala WhatsApp channel. Override with VITE_WHATSAPP_CHANNEL_URL if the channel ever changes. */
export const DEFAULT_WHATSAPP_CHANNEL_URL = 'https://whatsapp.com/channel/0029VbEH50105MUaVCzgge2Z'

export const SITE_URL = 'https://www.jobwahala.com'

/** The company as search engines should know it. `sameAs` lists our official profiles. */
export const organizationJsonLd = (sameAs: string[]) => ({
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'JobWahala',
  url: SITE_URL,
  logo: `${SITE_URL}/icon-512.png`,
  sameAs,
})
