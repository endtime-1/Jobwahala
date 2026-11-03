export type AlertCriteria = {
  query?: string
  location?: string
  jobType?: string
}

export type SavedSearch = AlertCriteria & {
  id: string
  emailAlerts: boolean
  createdAt: string
}

type FilterState = {
  search: string
  selectedTypes: string[]
  allTypes: string[]
  selectedLocation: string
  town?: string
}

/**
 * What a new alert should cover, based on the filters the visitor is using right now.
 * The country-level dropdown values are ignored: job locations are towns ("Kumasi"), so a
 * "Ghana" location would never match. Only "Remote Only" translates into a useful location.
 */
export const alertCriteriaFromFilters = ({ search, selectedTypes, allTypes, selectedLocation, town = '' }: FilterState): AlertCriteria => {
  const criteria: AlertCriteria = {}

  const query = search.trim()
  if (query) criteria.query = query

  if (selectedTypes.length === 1 && allTypes.includes(selectedTypes[0])) criteria.jobType = selectedTypes[0]

  // A town or city the visitor typed is a real, matchable location; otherwise only "Remote Only" is.
  if (town.trim()) criteria.location = town.trim()
  else if (selectedLocation === 'Remote Only') criteria.location = 'Remote'

  return criteria
}

export const hasAlertCriteria = (criteria: AlertCriteria) =>
  Boolean(criteria.query || criteria.location || criteria.jobType)

export const describeAlert = (criteria: AlertCriteria) =>
  [criteria.query, criteria.location, criteria.jobType].filter(Boolean).join(' · ')
