/** Link to the jobs page pre-filled with what the visitor typed on the homepage. */
export const buildJobSearchPath = (keyword: string, town: string) => {
  const params = new URLSearchParams()
  if (keyword.trim()) params.set('search', keyword.trim())
  if (town.trim()) params.set('location', town.trim())

  const query = params.toString()
  return query ? `/jobs?${query}` : '/jobs'
}
