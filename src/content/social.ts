/**
 * JobWahala's social profiles, in ONE place.
 *
 * Each link can be changed without touching code: set the environment variable named below (on the website
 * service in Railway) and redeploy. A network with no link is hidden everywhere (footer, About page, search
 * engine data). Add Instagram, TikTok or X later by setting its variable. The API reads the same links, for
 * the search-engine data on the home page, from the variable of the same name without the VITE_ part
 * (see backend/src/content/organization.ts, which must list the same networks).
 */
export const SITE_URL = 'https://www.jobwahala.com'

export type SocialKey = 'whatsapp' | 'linkedin' | 'facebook' | 'instagram' | 'tiktok' | 'x'

type Network = {
  key: SocialKey
  label: string
  /** The setting that holds the link. */
  envName: string
  /** Websites a link for this network may point to. */
  hosts: string[]
  /** Used when the setting is empty. Leave empty to hide the network until a link is set. */
  defaultUrl: string
}

export const SOCIAL_NETWORKS: Network[] = [
  { key: 'whatsapp', label: 'WhatsApp', envName: 'VITE_WHATSAPP_CHANNEL_URL', hosts: ['whatsapp.com'], defaultUrl: 'https://whatsapp.com/channel/0029VbEH50105MUaVCzgge2Z' },
  { key: 'linkedin', label: 'LinkedIn', envName: 'VITE_LINKEDIN_URL', hosts: ['linkedin.com'], defaultUrl: 'https://www.linkedin.com/company/145436921' },
  { key: 'facebook', label: 'Facebook', envName: 'VITE_FACEBOOK_URL', hosts: ['facebook.com', 'fb.com'], defaultUrl: 'https://www.facebook.com/profile.php?id=61576395645143' },
  { key: 'instagram', label: 'Instagram', envName: 'VITE_INSTAGRAM_URL', hosts: ['instagram.com'], defaultUrl: '' },
  { key: 'tiktok', label: 'TikTok', envName: 'VITE_TIKTOK_URL', hosts: ['tiktok.com'], defaultUrl: '' },
  { key: 'x', label: 'X', envName: 'VITE_X_URL', hosts: ['x.com', 'twitter.com'], defaultUrl: '' },
]

export const DEFAULT_WHATSAPP_CHANNEL_URL = SOCIAL_NETWORKS[0].defaultUrl

/** A real https link on one of the network's own websites (so a typo or a placeholder cannot end up on the site). */
export const isSocialUrl = (value: string, hosts: string[]) => {
  try {
    const url = new URL(value)
    const host = url.hostname.replace(/^(www\.|m\.|mobile\.)/, '')
    return url.protocol === 'https:' && hosts.some((allowed) => host === allowed || host.endsWith(`.${allowed}`)) && !/replace|placeholder|your/i.test(value)
  } catch {
    return false
  }
}

export type SocialLink = { key: SocialKey; label: string; url: string }

/** The profiles that have a link: the one in the settings if it is valid, otherwise the built-in one. */
export const resolveSocialLinks = (env: Record<string, unknown>): SocialLink[] =>
  SOCIAL_NETWORKS.map((network) => {
    const configured = typeof env[network.envName] === 'string' ? (env[network.envName] as string).trim() : ''
    const url = isSocialUrl(configured, network.hosts) ? configured : network.defaultUrl
    return { key: network.key, label: network.label, url }
  }).filter((link) => link.url)

/** The company as search engines should know it. `sameAs` lists our official profiles. */
export const organizationJsonLd = (sameAs: string[]) => ({
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'JobWahala',
  url: SITE_URL,
  logo: `${SITE_URL}/icon-512.png`,
  sameAs,
})
