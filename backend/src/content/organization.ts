/**
 * JobWahala's social profiles for the search-engine data (Organization sameAs) on the home page.
 * Mirrors src/content/social.ts. To change a link, set the variable named below on the API service (a network
 * with no link is left out). A test checks that both files list the same networks and built-in links.
 */
type Network = { key: string; envName: string; hosts: string[]; defaultUrl: string };

export const SOCIAL_NETWORKS: Network[] = [
  { key: 'whatsapp', envName: 'WHATSAPP_CHANNEL_URL', hosts: ['whatsapp.com'], defaultUrl: 'https://whatsapp.com/channel/0029VbEH50105MUaVCzgge2Z' },
  { key: 'linkedin', envName: 'LINKEDIN_URL', hosts: ['linkedin.com'], defaultUrl: 'https://www.linkedin.com/company/145436921' },
  { key: 'facebook', envName: 'FACEBOOK_URL', hosts: ['facebook.com', 'fb.com'], defaultUrl: 'https://www.facebook.com/profile.php?id=61576395645143' },
  { key: 'instagram', envName: 'INSTAGRAM_URL', hosts: ['instagram.com'], defaultUrl: '' },
  { key: 'tiktok', envName: 'TIKTOK_URL', hosts: ['tiktok.com'], defaultUrl: '' },
  { key: 'x', envName: 'X_URL', hosts: ['x.com', 'twitter.com'], defaultUrl: '' },
];

export const DEFAULT_WHATSAPP_CHANNEL_URL = SOCIAL_NETWORKS[0].defaultUrl;

const isSocialUrl = (value: string, hosts: string[]) => {
  try {
    const url = new URL(value);
    const host = url.hostname.replace(/^(www\.|m\.|mobile\.)/, '');
    return url.protocol === 'https:' && hosts.some((allowed) => host === allowed || host.endsWith(`.${allowed}`)) && !/replace|placeholder|your/i.test(value);
  } catch {
    return false;
  }
};

/** The profile links that are set (the valid one in the settings, otherwise the built-in one). */
export const socialLinks = (env: Record<string, string | undefined> = process.env) =>
  SOCIAL_NETWORKS.map((network) => {
    const configured = (env[network.envName] || '').trim();
    return { key: network.key, url: isSocialUrl(configured, network.hosts) ? configured : network.defaultUrl };
  }).filter((link) => link.url);

export const whatsappChannelUrl = () => socialLinks().find((link) => link.key === 'whatsapp')?.url ?? DEFAULT_WHATSAPP_CHANNEL_URL;

/** The company as search engines should know it; `sameAs` lists our official profiles. */
export const organizationJsonLd = (siteUrl: string) => ({
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'JobWahala',
  url: siteUrl,
  logo: `${siteUrl}/icon-512.png`,
  sameAs: socialLinks().map((link) => link.url),
});
