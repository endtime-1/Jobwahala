import { Search, Filter, ArrowRight, Zap, BriefcaseBusiness, Sparkles } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useEffect, useMemo, useState } from 'react'
import { apiCompareMarketplaceFreelancers, apiGetRecommendedServices, apiGetServices } from '../lib/api'
import { emailHandle, formatMoney, getDisplayName, getInitials } from '../lib/display'
import VerifiedBadge from '../components/VerifiedBadge'
import { useAuth } from '../context/AuthContext'

type ServiceRecord = {
  id: string
  title: string
  description: string
  price: number
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
      hourlyRate?: number | null
      bio?: string | null
      skills?: string | null
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
      } catch (err: any) {
        if (cancelled) return
        setError(err.message || 'Unable to load freelancer services right now.')
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
          bio: profile?.bio || service.description,
          skills,
          rate: formatMoney(profile?.hourlyRate || service.price),
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

      return matchesSearch && matchesCategory
    })
  }, [freelancerCards, search, selectedCategories])

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
    } catch (err: any) {
      setComparisonError(err.message || 'Unable to compare these freelancer options right now.')
    } finally {
      setIsComparing(false)
    }
  }

  return (
    <div className="container animate-in fade-in pt-24 pb-24 duration-1000 md:pt-28 xl:pt-32">
      <header className="dashboard-hero mb-8 px-5 py-6 sm:px-7 sm:py-7 lg:px-8 lg:py-8">
        <div className="relative z-10 flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <div className="dashboard-kicker mb-4">
              <Zap className="h-3.5 w-3.5" /> Live service marketplace
            </div>
            <h1 className="mb-3 text-4xl font-black leading-tight tracking-tighter text-text-main md:text-5xl">
              Hire Africa&apos;s modern independent operators.
            </h1>
            <p className="text-base font-medium tracking-tight text-text-muted md:text-lg">
              {isPersonalized
                ? 'Your marketplace is now AI-ranked around your current hiring signals, profile context, and service fit.'
                : 'Browse live backend services, narrow by specialization, and move directly from discovery into profile review and outreach.'}
            </p>
            {isPersonalized ? (
              <div className="dashboard-actions">
                <div className="dashboard-action-chip border-secondary/20 bg-secondary/10 text-secondary">
                  <Sparkles className="h-3.5 w-3.5" /> Personalized fit ranking is live
                </div>
              </div>
            ) : null}
            {categories.length > 0 ? (
              <div className="dashboard-actions hidden lg:flex">
                {categories.slice(0, 5).map((category) => (
                  <button
                    key={category}
                    type="button"
                    onClick={() => toggleCategory(category)}
                    className={`dashboard-action-chip ${selectedCategories.includes(category) ? 'border-secondary/30 bg-secondary/10 text-secondary' : ''}`}
                  >
                    {category}
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <div className="dashboard-panel grid min-w-0 grid-cols-3 gap-3 px-5 py-5 sm:min-w-[20rem] sm:px-6">
            <div className="rounded-2xl bg-white/80 px-3 py-4 text-center shadow-premium-sm">
              <p className="text-2xl font-black text-text-main">{freelancerCards.length}</p>
              <p className="mt-1 text-[9px] font-black uppercase tracking-[0.18em] text-text-light">Freelancers</p>
            </div>
            <div className="rounded-2xl bg-white/80 px-3 py-4 text-center shadow-premium-sm">
              <p className="text-2xl font-black text-text-main">{liveServiceCount}</p>
              <p className="mt-1 text-[9px] font-black uppercase tracking-[0.18em] text-text-light">Services</p>
            </div>
            <div className="rounded-2xl bg-white/80 px-3 py-4 text-center shadow-premium-sm">
              <p className="text-2xl font-black text-text-main">{categories.length}</p>
              <p className="mt-1 text-[9px] font-black uppercase tracking-[0.18em] text-text-light">
                {isPersonalized ? 'Top Fits' : 'Tracks'}
              </p>
            </div>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-12 lg:grid-cols-4">
        <aside className="hidden lg:block">
          <div className="dashboard-panel sticky top-28 bg-surface-alt/30 p-5 sm:p-6">
            <h3 className="font-black text-xs uppercase tracking-widest flex items-center gap-3 mb-8 text-text-main">
              <Filter className="h-4 w-4 text-secondary" /> Expert Filters
            </h3>
            <div className="space-y-10">
              <div>
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-text-light mb-6 block">Specialization</label>
                <div className="space-y-4">
                  {categories.map((category) => (
                    <label key={category} className="flex items-center gap-3 cursor-pointer group">
                      <div className="h-5 w-5 rounded-lg border border-surface-border group-hover:border-secondary transition-all flex items-center justify-center bg-white shadow-sm">
                        <div className={`h-2 w-2 rounded-sm bg-secondary transition-opacity ${selectedCategories.includes(category) ? 'opacity-100' : 'opacity-0'}`}></div>
                      </div>
                      <input
                        type="checkbox"
                        className="hidden"
                        checked={selectedCategories.includes(category)}
                        onChange={() => toggleCategory(category)}
                      />
                      <span className="text-sm font-bold text-text-muted group-hover:text-text-main transition-colors">{category}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </aside>

        <main className="lg:col-span-3 space-y-8">
          <section className="dashboard-panel space-y-5 p-4 sm:p-5 lg:hidden">
            <div className="relative group">
              <Search className="absolute left-5 top-1/2 -translate-y-1/2 h-5 w-5 text-text-light transition-colors group-focus-within:text-secondary" />
              <input
                type="text"
                placeholder="Search by expertise, service title, or skill..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="w-full rounded-2xl border-none bg-surface-alt/50 px-14 py-4 text-base font-bold focus:ring-2 focus:ring-secondary/10 shadow-inner placeholder:text-text-light/50"
              />
            </div>
            {categories.length > 0 ? (
              <div className="flex gap-3 overflow-x-auto pb-1">
                {categories.map((category) => (
                  <button
                    key={category}
                    type="button"
                    onClick={() => toggleCategory(category)}
                    className={`whitespace-nowrap rounded-full border px-4 py-2 text-[10px] font-black uppercase tracking-[0.18em] transition-all ${
                      selectedCategories.includes(category)
                        ? 'border-secondary/20 bg-secondary text-white'
                        : 'border-surface-border bg-white text-text-muted'
                    }`}
                  >
                    {category}
                  </button>
                ))}
              </div>
            ) : null}
          </section>

          <div className="dashboard-panel hidden p-4 sm:p-5 lg:block">
            <div className="relative group">
              <Search className="absolute left-6 top-1/2 -translate-y-1/2 h-5 w-5 text-text-light transition-colors group-focus-within:text-secondary" />
              <input
                type="text"
                placeholder="Search by expertise, service title, or skill..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="h-16 w-full rounded-3xl border-none bg-surface-alt/50 px-16 text-lg font-bold focus:ring-2 focus:ring-secondary/10 shadow-inner placeholder:text-text-light/50"
              />
            </div>
          </div>

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
                            {formatMoney(option.topService.price)} • {option.topService.deliveryTime || 'Flexible delivery'}
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {filteredFreelancers.map((freelancer) => (
                <div key={freelancer.id} className="dashboard-panel group relative overflow-hidden bg-white p-5 transition-all hover:shadow-premium-xl sm:p-8">
                  <div className="absolute top-0 right-0 h-32 w-32 bg-secondary/5 rounded-full -mr-16 -mt-16 group-hover:bg-secondary/10 transition-colors"></div>

                  <div className="flex items-center justify-between mb-10 relative z-10">
                    <div className="flex h-16 w-16 items-center justify-center rounded-[1.4rem] bg-gradient-to-br from-secondary to-secondary-dark text-xl font-black text-white shadow-lg transition-transform group-hover:scale-105 sm:h-20 sm:w-20 sm:rounded-3xl sm:text-2xl">
                      {freelancer.avatar}
                    </div>
                    <div className="text-right">
                      {isPersonalized && freelancer.topMatchScore !== null ? (
                        <p className="mb-2 inline-flex rounded-full border border-secondary/15 bg-secondary/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-secondary">
                          {freelancer.topMatchScore}% fit
                        </p>
                      ) : null}
                      <p className="text-2xl font-black text-text-main tracking-tighter">
                        {freelancer.rate}
                        <span className="text-xs text-text-light ml-1">/service</span>
                      </p>
                      <p className="text-[10px] font-black text-secondary uppercase tracking-widest">{freelancer.servicesCount} live services</p>
                    </div>
                  </div>

                    <div className="mb-8 relative z-10">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-2xl font-black text-text-main tracking-tight group-hover:text-secondary transition-colors">{freelancer.name}</h3>
                        <VerifiedBadge
                          type="freelancer"
                          status={freelancer.isVerified ? 'APPROVED' : 'UNVERIFIED'}
                          hideWhenUnverified
                          showText={false}
                        />
                      </div>
                    <p className="text-text-muted font-bold text-sm mb-4 uppercase tracking-wider">{freelancer.category}</p>
                    <p className="text-sm text-text-muted leading-relaxed">{freelancer.bio}</p>
                  </div>

                  <div className="flex flex-wrap gap-2 mb-6 relative z-10">
                    {(freelancer.skills.length > 0 ? freelancer.skills : [freelancer.category]).slice(0, 4).map((skill) => (
                      <span key={skill} className="px-4 py-2 bg-surface-alt rounded-xl text-[10px] font-black text-text-muted uppercase tracking-widest">
                        {skill}
                      </span>
                    ))}
                  </div>

                  <div className="rounded-2xl bg-surface-alt/30 border border-surface-border p-4 mb-8 relative z-10">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-text-light mb-2 flex items-center gap-2">
                      <BriefcaseBusiness className="h-3.5 w-3.5 text-secondary" /> Featured Service
                    </p>
                    <p className="text-sm font-black text-text-main">{freelancer.featuredService}</p>
                  </div>

                  {isPersonalized && freelancer.topMatchReasons.length > 0 ? (
                    <div className="rounded-2xl border border-secondary/10 bg-secondary/5 p-4 mb-8 relative z-10">
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-secondary mb-3 flex items-center gap-2">
                        <Sparkles className="h-3.5 w-3.5" /> Match Signals
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {freelancer.topMatchReasons.map((reason) => (
                          <span
                            key={`${freelancer.id}-${reason}`}
                            className="rounded-full border border-secondary/10 bg-white px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-text-muted"
                          >
                            {reason}
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  <div className="flex items-center justify-between gap-3 pt-8 border-t border-surface-border relative z-10">
                    {canCompareMarketplace ? (
                      <button
                        type="button"
                        aria-label={`Compare ${freelancer.name}`}
                        onClick={() => toggleComparisonSelection(freelancer.id)}
                        disabled={!selectedFreelancerIds.includes(freelancer.id) && selectedFreelancerIds.length >= 3}
                        className={`btn btn-sm px-5 text-[10px] font-black uppercase tracking-[0.18em] ${
                          selectedFreelancerIds.includes(freelancer.id)
                            ? 'border-secondary/20 bg-secondary text-white hover:bg-secondary-dark'
                            : 'btn-outline border-surface-border text-text-main'
                        } disabled:cursor-not-allowed disabled:opacity-40`}
                      >
                        {selectedFreelancerIds.includes(freelancer.id) ? 'Selected' : 'Compare'}
                      </button>
                    ) : (
                      <span />
                    )}
                    <Link
                      to={`/freelancers/${freelancer.id}`}
                      className="btn btn-outline btn-sm border-secondary text-secondary font-black uppercase tracking-widest text-[10px] px-6 flex items-center gap-2 group/link"
                    >
                      View Profile <ArrowRight className="h-3.5 w-3.5 group-hover/link:translate-x-1 transition-transform" />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
