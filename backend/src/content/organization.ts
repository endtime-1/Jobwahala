/** The JobWahala WhatsApp channel. Set WHATSAPP_CHANNEL_URL in the API's settings to change it. */
export const DEFAULT_WHATSAPP_CHANNEL_URL = 'https://whatsapp.com/channel/0029VbEH50105MUaVCzgge2Z';

export const whatsappChannelUrl = () => {
  const configured = (process.env.WHATSAPP_CHANNEL_URL || '').trim();
  return /^https:\/\/(www\.)?whatsapp\.com\//.test(configured) ? configured : DEFAULT_WHATSAPP_CHANNEL_URL;
};

/** The company as search engines should know it; `sameAs` lists our official profiles. */
export const organizationJsonLd = (siteUrl: string) => ({
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'JobWahala',
  url: siteUrl,
  logo: `${siteUrl}/icon-512.png`,
  sameAs: [whatsappChannelUrl()],
});
