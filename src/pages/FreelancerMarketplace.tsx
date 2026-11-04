import { Search, ArrowRight, BriefcaseBusiness, Sparkles } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useEffect, useMemo, useState } from 'react'
import { apiCompareMarketplaceFreelancers, apiGetRecommendedServices, apiGetServices } from '../lib/api'
import { formatMoney, getDisplayName, getInitials } from '../lib/display'
import VerifiedBadge from '../components/VerifiedBadge'
import { useAuth } from '../context/AuthContext'
import SEO from '../components/SEO'
import { getErrorMessage } from '../lib/errors'

type ServiceRecord = {
  id: string
  title: string
  description: string
  price: number
  currency?: string | null
  createdAt?: string
  deliveryTime?: string | null
  category?: string | null
  matchScore?: number
  matchReasons?: string[]
  freelancer: {
    id: string
    email: string
    verificationStatus?: string | null
    isVerified?: boolean
    freelancerProfile?: {
      firstName?: string | null
      lastName?: string | null
      tagline?: string | null
      availability?: string | null
      location?: string | null
      hourlyRate?: number | null
      bio?: string | null
      skills?: string | null
      preferredCurrency?: string | null
    } | null
  }
}

type FreelancerCard = {
  id: string
  name: string
  bio: string
  skills: string[]
  rate: string
  category: string
  featuredService: string
  servicesCount: number
  avatar: string
  tagline: string
  availability: string
  location: string
  isVerified: boolean
  topMatchScore: number | null
  topMatchReasons: string[]
}

type MarketplaceComparisonOption = {
  freelancer: ServiceRecord['freelancer']
  topService: {
    serviceId: string
    title: string
    category?: string | null
    price: number
    currency?: string | null
    deliveryTime?: string | null
    matchScore: number
    matchReasons: string[]
  }
  serviceCount: number
}

type MarketplaceComparisonRecord = {
  summary: string
  comparedCount: number
  options: MarketplaceComparisonOption[]
}

export default function FreelancerMarketplace() {
  const { user } = useAuth()
  const [services, setServices] = useState<ServiceRecord[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [isPersonalized, setIsPersonalized] = useState(false)
  const [selectedFreelancerIds, setSelectedFreelancerIds] = useState<string[]>([])
  const [comparison, setComparison] = useState<MarketplaceComparisonRecord | null>(null)
  const [comparisonError, setComparisonError] = useState('')
  const [isComparing, setIsComparing] = useState(false)

  useEffect(() => {
    let cancelled = false
    const canLoadRecommendations = user?.role === 'SEEKER' || user?.role === 'EMPLOYER'

    const loadServices = async () => {
      setIsLoading(true)

      try {
        if (canLoadRecommendations) {
          try {
            const recommendationData = await apiGetRecommendedServices()
            if (cancelled) return

            setServices(recommendationData.services as ServiceRecord[])
            setIsPersonalized(Boolean(recommendationData.personalized))
            setError('')
            return
          } catch {
            if (cancelled) return
          }
        }

        const data = await apiGetServices()
        if (cancelled) return

        setServices(data.services as ServiceRecord[])
        setIsPersonalized(false)
        setError('')
      } catch (err) {
        if (cancelled) return
        setError(getErrorMessage(err, 'Unable to load freelancer services right now.'))
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    loadServices()

    return () => {
      cancelled = true
    }
  }, [user?.role])

  const toggleCategory = (category: string) => {
    setSelectedCategories((prev) =>
      prev.includes(category) ? prev.filter((value) => value !== category) : [...prev, category],
    )
  }

  const freelancerCards = useMemo(() => {
    const grouped = new Map<string, FreelancerCard>()

    services.forEach((service) => {
      const profile = service.freelancer.freelancerProfile
      const name = getDisplayName(profile?.firstName, profile?.lastName, service.freelancer.email)
      const skills = (profile?.skills || '')
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean)

      if (!grouped.has(service.freelancer.id)) {
        grouped.set(service.freelancer.id, {
          id: service.freelancer.id,
          name,
          tagline: profile?.tagline || '',
          availability: profile?.availability || 'AVAILABLE',
          location: profile?.location || '',
          bio: profile?.bio || service.description,
          skills,
          rate: formatMoney(profile?.hourlyRate || service.price, profile?.preferredCurrency || service.currency || 'GHS'),
          category: service.category || 'General',
          featuredService: service.title,
          servicesCount: 1,
          avatar: getInitials(name),
          isVerified: Boolean(service.freelancer.isVerified),
          topMatchScore: typeof service.matchScore === 'number' ? service.matchScore : null,
          topMatchReasons: service.matchReasons || [],
        })
        return
      }

      const current = grouped.get(service.freelancer.id)!
      current.servicesCount += 1
      if (current.skills.length === 0 && skills.length > 0) {
        current.skills = skills
      }

      if (current.category === 'General' && service.category) {
        current.category = service.category
      }

      if (
        typeof service.matchScore === 'number' &&
        (current.topMatchScore === null || service.matchScore > current.topMatchScore)
      ) {
        current.topMatchScore = service.matchScore
        current.topMatchReasons = service.matchReasons || []
        current.featuredService = service.title
        current.category = service.category || current.category
      }
    })

    return Array.from(grouped.values()).sort((left, right) => {
      if (isPersonalized) {
        const scoreDelta = (right.topMatchScore ?? -1) - (left.topMatchScore ?? -1)
        if (scoreDelta !== 0) {
          return scoreDelta
        }
      }

      if (right.servicesCount !== left.servicesCount) {
        return right.servicesCount - left.servicesCount
      }

      return left.name.localeCompare(right.name)
    })
  }, [isPersonalized, services])

  const categories = useMemo(() => {
    return Array.from(new Set(freelancerCards.map((card) => card.category))).filter(Boolean)
  }, [freelancerCards])

  const locations = useMemo(() => {
    return Array.from(new Set(freelancerCards.map((card) => card.location))).filter(Boolean).sort()
  }, [freelancerCards])

  const [selectedLocations, setSelectedLocations] = useState<string[]>([])

  const filteredFreelancers = useMemo(() => {
    return freelancerCards.filter((freelancer) => {
      const q = search.toLowerCase()
      const matchesSearch =
        !search ||
        freelancer.name.toLowerCase().includes(q) ||
        freelancer.bio.toLowerCase().includes(q) ||
        freelancer.featuredService.toLowerCase().includes(q) ||
        freelancer.skills.some((skill) => skill.toLowerCase().includes(q))

      const matchesCategory =
        selectedCategories.length === 0 || selectedCategories.includes(freelancer.category)

      const matchesLocation =
        selectedLocations.length === 0 || selectedLocations.includes(freelancer.location)

      return matchesSearch && matchesCategory && matchesLocation
    })
  }, [freelancerCards, search, selectedCategories, selectedLocations])

  const liveServiceCount = services.length
  const canCompareMarketplace = user?.role === 'SEEKER' || user?.role === 'EMPLOYER'
  const topRecommendations = useMemo(
    () =>
      isPersonalized
        ? filteredFreelancers.filter((freelancer) => freelancer.topMatchScore !== null).slice(0, 3)
        : [],
    [filteredFreelancers, isPersonalized],
  )
  const selectedComparisonCards = useMemo(
    () =>
      selectedFreelancerIds
        .map((freelancerId) => freelancerCards.find((card) => card.id === freelancerId) || null)
        .filter(Boolean) as FreelancerCard[],
    [freelancerCards, selectedFreelancerIds],
  )

  useEffect(() => {
    const availableFreelancerIds = new Set(freelancerCards.map((card) => card.id))
    setSelectedFreelancerIds((current) => current.filter((freelancerId) => availableFreelancerIds.has(freelancerId)))
  }, [freelancerCards])

  const toggleComparisonSelection = (freelancerId: string) => {
    setComparison(null)
    setComparisonError('')
    setSelectedFreelancerIds((current) => {
      if (current.includes(freelancerId)) {
        return current.filter((value) => value !== freelancerId)
      }

      if (current.length >= 3) {
        return current
      }

      return [...current, freelancerId]
    })
  }

  const handleGenerateComparison = async () => {
    if (selectedFreelancerIds.length < 2) {
      return
    }

    setComparisonError('')
    setIsComparing(true)

    try {
      const data = await apiCompareMarketplaceFreelancers(selectedFreelancerIds)
      setComparison((data.comparison || null) as MarketplaceComparisonRecord | null)
    } catch (err) {
      setComparisonError(getErrorMessage(err, 'Unable to compare these freelancer options right now.'))
    } finally {
      setIsComparing(false)
    }
  }

  return (
    <div className="container pt-24 pb-24 xl:pt-28">
      <SEO 
        title="Hire Skilled Freelancers Across Africa | Tech, Design & More"
        description="Connect with top-rated Ghanaian software engineers, UI/UX designers, and digital marketers. Verified talent for global high-growth projects."
        keywords="hire ghanaian developers, freelance designers accra, top talent ghana, jobwahala marketplace"
      />
      <header
        className="relative overflow-hidden rounded-[2rem] px-5 py-8 text-white sm:px-9 sm:py-11"
        style={{
          background:
            'radial-gradient(700px 360px at 100% 0%, rgba(47,109,246,0.5), transparent 60%), radial-gradient(500px 300px at 0% 100%, rgba(255,197,49,0.16), transparent 60%), #101a2b',
        }}
      >
        <div className="heritage-strip absolute inset-x-0 top-0" aria-hidden />
        <p className="page-eyebrow">Hire freelancers</p>
        <h1 className="mt-3 max-w-3xl text-4xl font-black leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
          Hire skilled people across Africa. <span className="text-gold">Pay when you approve.</span>
        </h1>
        <p className="mt-4 max-w-2xl text-base font-medium text-white/75 sm:text-lg">
          {isPersonalized
            ? 'Freelancers are ranked for you, based on your profile and what you have been looking for.'
            : 'Browse services from freelancers, pick a specialty, then review a profile and get in touch. Payment is held safely until you approve the work.'}
        </p>

        <div className="relative mt-7 rounded-2xl bg-white p-2 shadow-premium-xl">
          <Search className="pointer-events-none absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2 text-text-light" />
          <input
            type="text"
            aria-label="Search freelancers"
            placeholder="Search by skill, service or name"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="w-full rounded-xl border-none bg-transparent py-4 pl-12 pr-4 text-base font-semibold text-text-main focus:ring-2 focus:ring-secondary/25"
          />
        </div>

        {categories.length > 0 ? (
          <div className="mt-5 flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Specialty">
            {categories.slice(0, 8).map((category) => (
              <button
                key={category}
                type="button"
                onClick={() => toggleCategory(category)}
                aria-pressed={selectedCategories.includes(category)}
                className={`whitespace-nowrap rounded-full border px-4 py-2 text-sm font-bold transition-colors ${
                  selectedCategories.includes(category)
                    ? 'border-gold bg-gold text-primary'
                    : 'border-white/20 bg-white/10 text-white hover:bg-white/20'
                }`}
              >
                {category}
              </button>
            ))}
          </div>
        ) : null}

        {!isLoading && !error ? (
          <p className="mt-5 text-sm font-semibold text-white/70">
            {freelancerCards.length} {freelancerCards.length === 1 ? 'freelancer' : 'freelancers'} · {liveServiceCount} live{' '}
            {liveServiceCount === 1 ? 'service' : 'services'}
          </p>
        ) : null}
      </header>

      <div className="mt-6">
        <main className="space-y-6">
          {locations.length > 0 || selectedCategories.length > 0 || selectedLocations.length > 0 || search.trim() ? (
            <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-surface-border bg-white p-3 sm:p-4">
              {locations.length > 0 ? <span className="mr-1 hidden text-sm font-bold text-text-muted sm:inline">City</span> : null}
              {locations.map((loc) => (
                <button
                  key={loc}
                  type="button"
                  aria-pressed={selectedLocations.includes(loc)}
                  onClick={() =>
                    setSelectedLocations((prev) => (prev.includes(loc) ? prev.filter((value) => value !== loc) : [...prev, loc]))
                  }
                  className={`rounded-full border px-4 py-2 text-sm font-bold transition-colors ${
                    selectedLocations.includes(loc)
                      ? 'border-secondary bg-secondary/10 text-secondary'
                      : 'border-surface-border bg-white text-text-muted hover:border-secondary/40'
                  }`}
                >
                  {loc}
                </button>
              ))}
              <div className="ml-auto flex items-center gap-3">
                <p className="text-sm font-bold text-text-main">
                  {filteredFreelancers.length} {filteredFreelancers.length === 1 ? 'result' : 'results'}
                </p>
                {selectedCategories.length > 0 || selectedLocations.length > 0 || search.trim() ? (
                  <button
                    type="button"
                    onClick={() => {
                      setSearch('')
                      setSelectedCategories([])
                      setSelectedLocations([])
                    }}
                    className="inline-flex items-center gap-1 rounded-full bg-surface-alt px-3 py-1.5 text-sm font-bold text-text-muted hover:text-text-main"
                  >
                    Clear
                  </button>
                ) : null}
              </div>
            </div>
          ) : null}

          {isPersonalized && topRecommendations.length > 0 ? (
            <section className="dashboard-panel overflow-hidden p-5 sm:p-6">
              <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.22em] text-secondary">AI Service Picks</p>
                  <h2 className="mt-2 text-2xl font-black tracking-tight text-text-main">
                    Best-fit operators for your current brief.
                  </h2>
                </div>
                <p className="max-w-xl text-sm font-medium text-text-muted">
                  These cards are ranked from your profile and hiring context. Open a profile to inspect the live services and request with AI-assisted guidance.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                {topRecommendations.map((freelancer) => (
                  <Link
                    key={freelancer.id}
                    to={`/freelancers/${freelancer.id}`}
                    className="rounded-[2rem] border border-surface-border bg-surface-alt/40 p-5 transition-all hover:border-secondary/20 hover:bg-white"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-lg font-black tracking-tight text-text-main">{freelancer.name}</p>
                        <p className="mt-1 text-[10px] font-black uppercase tracking-[0.2em] text-text-light">
                          {freelancer.category}
                        </p>
                      </div>
                      <div className="rounded-full border border-secondary/15 bg-secondary/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-secondary">
                        {freelancer.topMatchScore}% fit
                      </div>
                    </div>
                    <p className="mt-4 text-sm font-bold text-text-main">{freelancer.featuredService}</p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {freelancer.topMatchReasons.slice(0, 2).map((reason) => (
                        <span
                          key={`${freelancer.id}-${reason}`}
                          className="rounded-full border border-surface-border bg-white px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-text-muted"
                        >
                          {reason}
                        </span>
                      ))}
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          ) : null}

          {canCompareMarketplace ? (
            <section className="dashboard-panel overflow-hidden p-5 sm:p-6">
              <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.22em] text-secondary">AI Option Comparison</p>
                  <h2 className="mt-2 text-2xl font-black tracking-tight text-text-main">
                    Compare shortlist-ready freelancer options.
                  </h2>
                  <p className="mt-2 max-w-2xl text-sm font-medium text-text-muted">
                    Select two or three freelancer cards below and generate a decision brief around service fit, delivery angle, and visible scope alignment.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleGenerateComparison}
                  disabled={selectedFreelancerIds.length < 2 || isComparing}
                  className="btn btn-primary btn-sm px-5 py-3 text-[11px] font-black uppercase tracking-[0.18em] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Sparkles className="h-4 w-4" /> {isComparing ? 'Comparing...' : 'Generate AI Comparison'}
                </button>
              </div>

              {selectedComparisonCards.length > 0 ? (
                <div className="flex flex-wrap gap-3">
                  {selectedComparisonCards.map((freelancer) => (
                    <button
                      key={freelancer.id}
                      type="button"
                      onClick={() => toggleComparisonSelection(freelancer.id)}
                      className="rounded-full border border-secondary/15 bg-secondary/10 px-4 py-2 text-[10px] font-black uppercase tracking-[0.16em] text-secondary transition-colors hover:bg-secondary hover:text-white"
                    >
                      {freelancer.name} selected
                    </button>
                  ))}
                </div>
              ) : (
                <div className="rounded-[1.8rem] border border-dashed border-surface-border bg-surface-alt/30 px-5 py-6">
                  <p className="text-sm font-bold text-text-main">No freelancer options selected yet.</p>
                  <p className="mt-2 text-sm font-medium text-text-muted">
                    Pick up to three cards from the marketplace grid to generate a side-by-side AI brief.
                  </p>
                </div>
              )}

              {comparisonError ? (
                <div className="mt-5 rounded-[1.6rem] border border-error/10 bg-error/5 px-5 py-4">
                  <p className="text-sm font-semibold text-error">{comparisonError}</p>
                </div>
              ) : null}

              {comparison ? (
                <div className="mt-5 space-y-4">
                  <div className="rounded-[1.8rem] border border-secondary/10 bg-secondary/5 px-5 py-5">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-secondary">
                        {comparison.comparedCount} options compared
                      </p>
                      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-text-light">
                        Ranked by current marketplace fit
                      </p>
                    </div>
                    <p className="mt-3 text-sm font-semibold leading-7 text-text-main">{comparison.summary}</p>
                  </div>

                  <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
                    {comparison.options.map((option) => {
                      const profile = option.freelancer.freelancerProfile
                      const freelancerName = getDisplayName(profile?.firstName, profile?.lastName, option.freelancer.email)

                      return (
                        <div
                          key={option.freelancer.id}
                          className="rounded-[1.8rem] border border-surface-border bg-surface-alt/35 p-5"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-lg font-black tracking-tight text-text-main">{freelancerName}</p>
                              <p className="mt-1 text-[10px] font-black uppercase tracking-[0.18em] text-text-light">
                                {option.topService.category || 'General'}
                              </p>
                            </div>
                            <span className="rounded-full border border-secondary/15 bg-secondary/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-secondary">
                              {option.topService.matchScore}% fit
                            </span>
                          </div>

                          <p className="mt-4 text-sm font-black text-text-main">{option.topService.title}</p>
                          <p className="mt-2 text-sm font-medium text-text-muted">
                            {formatMoney(option.topService.price, option.topService.currency || 'GHS')} • {option.topService.deliveryTime || 'Flexible delivery'}
                          </p>

                          <div className="mt-4 flex flex-wrap gap-2">
                            {option.topService.matchReasons.slice(0, 3).map((reason) => (
                              <span
                                key={`${option.freelancer.id}-${reason}`}
                                className="rounded-full border border-surface-border bg-white px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-text-muted"
                              >
                                {reason}
                              </span>
                            ))}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ) : null}
            </section>
          ) : null}

          {isLoading ? (
            <div className="dashboard-panel p-6 sm:p-10">
              <p className="text-sm font-black uppercase tracking-[0.2em] text-text-light">Loading live freelancers...</p>
            </div>
          ) : error ? (
            <div className="dashboard-panel border-error/10 p-6 sm:p-10">
              <p className="text-sm font-semibold text-error">{error}</p>
            </div>
          ) : filteredFreelancers.length === 0 ? (
            <div className="dashboard-panel py-16 text-center sm:py-20">
              <p className="text-2xl font-black text-text-main mb-4 tracking-tighter">No freelancers found</p>
              <p className="text-text-muted font-medium">Try adjusting your search or filters.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {filteredFreelancers.map((freelancer) => (
                <article
                  key={freelancer.id}
                  className="group flex flex-col rounded-2xl border border-surface-border bg-white p-5 transition-all hover:-translate-y-0.5 hover:border-secondary/40 hover:shadow-premium-md sm:p-6"
                >
                  <div className="flex items-start gap-4">
                    <div className="flex h-16 w-16 flex-none items-center justify-center rounded-2xl bg-gradient-to-br from-secondary to-secondary-dark text-2xl font-black text-white">
                      {freelancer.avatar}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-xl font-extrabold leading-snug tracking-tight text-text-main group-hover:text-secondary">{freelancer.name}</h3>
                        <VerifiedBadge
                          type="freelancer"
                          status={freelancer.isVerified ? 'APPROVED' : 'UNVERIFIED'}
                          hideWhenUnverified
                          showText={false}
                        />
                      </div>
                      <p className="mt-0.5 text-sm font-bold text-text-muted">
                        {freelancer.category}
                        {freelancer.location ? ` · ${freelancer.location}` : ''}
                      </p>
                      <p className="mt-1.5 inline-flex items-center gap-1.5 text-xs font-bold text-text-muted">
                        <span
                          className={`h-2 w-2 rounded-full ${
                            freelancer.availability === 'AVAILABLE' ? 'bg-success' : freelancer.availability === 'BUSY' ? 'bg-accent' : 'bg-text-light'
                          }`}
                        />
                        {freelancer.availability === 'AVAILABLE' ? 'Available now' : freelancer.availability === 'BUSY' ? 'Busy' : 'Away'}
                      </p>
                    </div>
                    {isPersonalized && freelancer.topMatchScore !== null ? (
                      <span className="rounded-full bg-secondary/10 px-3 py-1 text-xs font-extrabold text-secondary">{freelancer.topMatchScore}% fit</span>
                    ) : null}
                  </div>

                  <p className="mt-4 text-base font-bold italic leading-snug text-text-main">“{freelancer.tagline || 'Expert professional'}”</p>
                  <p className="mt-2 line-clamp-2 text-sm font-medium leading-relaxed text-text-muted">{freelancer.bio}</p>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {(freelancer.skills.length > 0 ? freelancer.skills : [freelancer.category]).slice(0, 4).map((skill) => (
                      <span key={skill} className="rounded-full bg-surface-alt px-3 py-1 text-sm font-bold text-text-muted">
                        {skill}
                      </span>
                    ))}
                  </div>

                  <div className="mt-4 rounded-xl bg-surface-alt/60 p-3.5">
                    <p className="flex items-center gap-2 text-xs font-bold text-text-muted">
                      <BriefcaseBusiness className="h-3.5 w-3.5 text-secondary" /> Featured service
                    </p>
                    <p className="mt-1 text-sm font-extrabold text-text-main">{freelancer.featuredService}</p>
                  </div>

                  {isPersonalized && freelancer.topMatchReasons.length > 0 ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {freelancer.topMatchReasons.slice(0, 3).map((reason) => (
                        <span key={`${freelancer.id}-${reason}`} className="rounded-full border border-secondary/20 bg-secondary/5 px-3 py-1 text-xs font-bold text-secondary">
                          {reason}
                        </span>
                      ))}
                    </div>
                  ) : null}

                  <div className="mt-auto flex items-center justify-between gap-3 border-t border-surface-border pt-4">
                    <div>
                      <p className="text-xs font-semibold text-text-light">Services from</p>
                      <p className="text-lg font-black tracking-tight text-text-main">{freelancer.rate}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {canCompareMarketplace ? (
                        <button
                          type="button"
                          aria-label={`Compare ${freelancer.name}`}
                          onClick={() => toggleComparisonSelection(freelancer.id)}
                          disabled={!selectedFreelancerIds.includes(freelancer.id) && selectedFreelancerIds.length >= 3}
                          className={`btn btn-sm px-4 ${
                            selectedFreelancerIds.includes(freelancer.id)
                              ? 'border-secondary/20 bg-secondary text-white hover:bg-secondary-dark'
                              : 'btn-outline border-surface-border text-text-main'
                          } disabled:cursor-not-allowed disabled:opacity-40`}
                        >
                          {selectedFreelancerIds.includes(freelancer.id) ? 'Selected' : 'Compare'}
                        </button>
                      ) : null}
                      <Link to={`/freelancers/${freelancer.id}`} className="btn btn-primary btn-sm px-4">
                        View profile <ArrowRight className="h-4 w-4" />
                      </Link>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
