export type JobWorkMode = 'REMOTE' | 'HYBRID' | 'ONSITE'

const REMOTE_PATTERNS = ['remote', 'work from home', 'wfh', 'distributed', 'anywhere']

const normalizeLocation = (location?: string | null) => location?.trim() || ''

export const getJobLocationLabel = (location?: string | null) => normalizeLocation(location) || 'Remote'

export const getJobWorkMode = (location?: string | null): JobWorkMode => {
  const normalizedLocation = normalizeLocation(location).toLowerCase()

  if (!normalizedLocation) {
    return 'REMOTE'
  }

  if (normalizedLocation.includes('hybrid')) {
    return 'HYBRID'
  }

  if (REMOTE_PATTERNS.some((pattern) => normalizedLocation.includes(pattern))) {
    return 'REMOTE'
  }

  return 'ONSITE'
}

export const getJobWorkModeLabel = (location?: string | null) => {
  const workMode = getJobWorkMode(location)

  if (workMode === 'REMOTE') return 'Remote'
  if (workMode === 'HYBRID') return 'Hybrid'
  return 'Onsite'
}

export const isRemoteJob = (location?: string | null) => getJobWorkMode(location) === 'REMOTE'

export const formatJobLocationWithWorkMode = (location?: string | null) => {
  const normalizedLocation = normalizeLocation(location)
  const workModeLabel = getJobWorkModeLabel(location)

  if (!normalizedLocation) {
    return workModeLabel
  }

  if (normalizedLocation.toLowerCase().includes(workModeLabel.toLowerCase())) {
    return normalizedLocation
  }

  return `${normalizedLocation} / ${workModeLabel}`
}

export const getJobWorkModeBadgeClass = (location?: string | null) => {
  const workMode = getJobWorkMode(location)

  if (workMode === 'REMOTE') return 'bg-success text-white'
  if (workMode === 'HYBRID') return 'bg-secondary text-white'
  return 'bg-surface-alt text-text-main border-surface-border'
}
