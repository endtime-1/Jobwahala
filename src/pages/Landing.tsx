import { useEffect, useState } from 'react'
import { Briefcase, Users, Shield, Search, ArrowRight, Star, Zap, TrendingUp, Code2, MapPin, Clock } from 'lucide-react'
import { Link } from 'react-router-dom'
import VerifiedBadge from '../components/VerifiedBadge'
import { apiGetPlatformStats } from '../lib/api'

interface PlatformStats {
  counts: {
    openJobs: number
    freelancers: number
    seekers: number
    employers: number
    activeServices: number
    totalApplications: number
    totalTalent: number
  }
  recentJobs: Array<{
    id: string
    title: string
    location: string | null
    type: string | null
    salary: string | null
    category: string | null
    companyName: string
    createdAt: string
  }>
  topFreelancers: Array<{
    id: string
    name: string
    skills: string[]
    hourlyRate: number | null
    serviceCount: number
    rating: number
    reviewCount: number
    initials: string
  }>
}

const formatCount = (n: number) => {
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k+`
  return n > 0 ? `${n}+` : '0'
}

const timeAgo = (dateStr: string) => {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

export default function Landing() {
  const [stats, setStats] = useState<PlatformStats | null>(null)
  const [statsLoaded, setStatsLoaded] = useState(false)

  useEffect(() => {
    apiGetPlatformStats()
      .then((res) => {
        if (res.success && res.stats) {
          setStats(res.stats as PlatformStats)
        }
      })
      .catch(() => {})
      .finally(() => setStatsLoaded(true))
  }, [])

  const counts = stats?.counts
  const recentJobs = stats?.recentJobs || []
  const topFreelancers = stats?.topFreelancers || []

  return (
    <div className="fade-in">
      {/* Hero Section */}
      <section className="relative overflow-hidden pt-24 pb-20 md:pt-28 md:pb-24 xl:pt-32 xl:pb-32">
        <div className="container relative z-10">
          <div className="grid grid-cols-1 gap-14 lg:grid-cols-12 lg:items-center lg:gap-16">
            {/* Left Content Column */}
            <div className="lg:col-span-7 text-left animate-in slide-in-from-left duration-1000">
              <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-primary/10 bg-white/80 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-primary shadow-premium-sm backdrop-blur-xl">
                <Zap className="h-3 w-3 fill-primary" /> New: AI-Powered Talent Matching
              </div>
              <h1 className="mb-8 max-w-2xl text-5xl font-black tracking-tighter leading-[0.92] text-text-main sm:text-6xl md:text-[88px]">
                The Future of Work <br/>
                <span className="text-primary italic">is African.</span>
              </h1>
              <p className="mb-10 max-w-xl text-base font-medium leading-relaxed text-text-muted sm:text-lg md:text-xl">
                JobWahala is the elite workspace connecting the continent's most ambitious talent with global high-growth opportunities. 
              </p>
              <div className="mb-10 flex flex-col gap-4 sm:flex-row">
                <Link to="/onboarding?role=seeker" className="btn btn-primary btn-lg px-8 sm:px-10">
                  Join as Talent <ArrowRight className="h-6 w-6" />
                </Link>
                <Link to="/onboarding?role=employer" className="btn btn-outline btn-lg px-8 sm:px-10">
                  Hire Elite Teams
                </Link>
              </div>

              {/* Mobile Workspace Preview */}
              <div className="mb-10 lg:hidden">
                <div className="rounded-[2rem] border border-white/70 bg-white/78 p-4 shadow-premium-lg backdrop-blur-2xl">
                  <div className="rounded-[1.7rem] bg-[linear-gradient(160deg,#101a2b_0%,#1f4fd5_100%)] p-5 text-white shadow-premium-md">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.24em] text-white/60">Live Platform</p>
                        <h3 className="mt-2 text-xl font-black tracking-tight">Ship work from anywhere.</h3>
                      </div>
                      <div className="rounded-2xl bg-white/12 px-3 py-2 text-[10px] font-black uppercase tracking-[0.18em]">
                        Live
                      </div>
                    </div>
                    <div className="mt-5 grid grid-cols-2 gap-3">
                      <div className="rounded-2xl bg-white/10 p-4">
                        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/55">Open Roles</p>
                        <p className="mt-3 text-3xl font-black">{counts ? formatCount(counts.openJobs) : '—'}</p>
                      </div>
                      <div className="rounded-2xl bg-white/10 p-4">
                        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/55">Talent Pool</p>
                        <p className="mt-3 text-3xl font-black">{counts ? formatCount(counts.totalTalent) : '—'}</p>
                      </div>
                    </div>
                    {recentJobs[0] && (
                      <div className="mt-4 rounded-2xl bg-white/10 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-black">{recentJobs[0].title}</p>
                            <p className="mt-1 text-[10px] font-black uppercase tracking-[0.18em] text-white/60">
                              {recentJobs[0].companyName} / {recentJobs[0].location || 'Remote'}
                            </p>
                          </div>
                          <span className="rounded-full bg-white px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-primary">
                            New
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              
              {/* Hero Search */}
              <div className="max-w-3xl relative group">
                <div className="absolute -inset-4 bg-gradient-to-r from-primary/10 via-secondary/10 to-primary/10 rounded-[4rem] blur-2xl opacity-0 group-hover:opacity-100 transition duration-1000 group-hover:duration-500"></div>
                <div className="relative bg-white border border-surface-border/50 shadow-premium-2xl p-2 md:p-3 rounded-[3.5rem] flex flex-col md:flex-row items-center gap-3">
                  <div className="flex-grow flex items-center w-full pl-2">
                    <div className="h-14 w-14 bg-surface-alt rounded-full flex items-center justify-center flex-shrink-0 shadow-sm border border-surface-border/30 group-focus-within:border-primary/30 transition-colors">
                      <Search className="h-6 w-6 text-primary" />
                    </div>
                    <div className="flex-grow relative ml-4">
                      <input 
                        type="text" 
                        placeholder="Design, Engineering, or Remote roles..." 
                        className="w-full border-none bg-transparent py-4 text-xl font-bold text-text-main placeholder:text-text-muted/50 focus:ring-0"
                      />
                      <div className="absolute right-0 top-1/2 -translate-y-1/2 hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-surface-border bg-surface-alt/50 text-[10px] font-black text-text-light shadow-inner">
                        <span className="opacity-50">Press</span> Cmd+K
                      </div>
                    </div>
                  </div>
                  <Link to="/onboarding?role=seeker" className="btn btn-primary btn-lg px-12 rounded-full w-full md:w-auto shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all text-sm font-black uppercase tracking-widest">
                    Search Gigs
                  </Link>
                </div>
                
                {/* Trending Tags */}
                <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-3 px-4 md:px-8 animate-in fade-in slide-in-from-top-4 duration-1000 delay-500">
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-text-light italic">Trending Now</span>
                  {['Product Design', 'Solidity', 'Full-stack', 'Remote'].map((tag) => (
                    <button key={tag} className="text-xs font-bold text-text-muted hover:text-primary transition-colors flex items-center gap-1.5 group">
                      <span className="h-1 w-1 rounded-full bg-surface-border group-hover:bg-primary transition-colors"></span>
                      {tag}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Right Visual Column */}
            <div className="hidden lg:block lg:col-span-5 relative animate-in zoom-in duration-1000 delay-300">
              <div className="relative aspect-square">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-primary/5 rounded-[4rem] rotate-6 blur-3xl animate-pulse"></div>
                
                <div className="absolute top-0 right-0 w-64 h-64 bg-white/40 backdrop-blur-3xl border border-white/50 rounded-[3rem] shadow-premium-xl z-20 flex flex-col p-8 rotate-3 hover:rotate-0 transition-transform duration-700">
                  <div className="h-12 w-12 rounded-2xl bg-primary text-white flex items-center justify-center mb-6 shadow-lg shadow-primary/20">
                    <Zap className="h-6 w-6" />
                  </div>
                  <div className="h-2 bg-primary/10 rounded-full w-full mb-3"></div>
                  <div className="h-2 bg-primary/10 rounded-full w-3/4 mb-3"></div>
                  <div className="h-2 bg-primary-light rounded-full w-1/2 mt-auto"></div>
                </div>

                <div className="absolute bottom-10 left-0 w-72 h-48 bg-white/60 backdrop-blur-2xl border border-white/50 rounded-[3rem] shadow-premium-2xl z-30 p-8 -rotate-6 hover:rotate-0 transition-transform duration-700">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="h-12 w-12 rounded-full bg-secondary/10 flex items-center justify-center font-black text-secondary">
                      {topFreelancers[0]?.initials || 'AB'}
                    </div>
                    <div className="space-y-2 flex-grow">
                      <div className="h-2 bg-surface-border rounded-full w-full"></div>
                      <div className="h-2 bg-surface-border rounded-full w-2/3"></div>
                    </div>
                  </div>
                  <div className="h-10 bg-secondary text-white rounded-xl flex items-center justify-center text-[10px] font-black uppercase tracking-widest">
                    {topFreelancers[0]?.rating ? `Rated ${topFreelancers[0].rating}★` : 'Matched 98%'}
                  </div>
                </div>

                {/* Decorative Neural Grid */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[120%] pointer-events-none -z-10 opacity-20">
                  <svg width="100%" height="100%" viewBox="0 0 400 400" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="200" cy="200" r="150" stroke="currentColor" strokeWidth="0.5" className="text-primary" strokeDasharray="4 4" />
                    <circle cx="200" cy="200" r="100" stroke="currentColor" strokeWidth="0.5" className="text-primary" />
                    <path d="M200 50V350M50 200H350" stroke="currentColor" strokeWidth="0.5" className="text-primary" />
                  </svg>
                </div>
              </div>
            </div>
          </div>
        </div>
        {/* Abstract background elements */}
        <div className="absolute top-[10%] right-[-5%] w-[800px] h-[800px] bg-primary/5 rounded-full blur-[140px] -z-10 animate-pulse"></div>
        <div className="absolute bottom-[20%] left-[-10%] w-[600px] h-[600px] bg-secondary/5 rounded-full blur-[120px] -z-10"></div>
      </section>

      {/* Live Stats Ribbon */}
      {statsLoaded && counts && (
        <section className="border-y border-surface-border py-14 md:py-16 bg-surface-alt/20 animate-in fade-in duration-700">
          <div className="container">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-12 lg:gap-16">
              {[
                { label: 'Open Roles', value: formatCount(counts.openJobs), icon: Briefcase, color: 'text-primary' },
                { label: 'Active Freelancers', value: formatCount(counts.freelancers), icon: Code2, color: 'text-secondary' },
                { label: 'Talent Pool', value: formatCount(counts.totalTalent), icon: Users, color: 'text-accent' },
                { label: 'Applications', value: formatCount(counts.totalApplications), icon: TrendingUp, color: 'text-primary' },
              ].map((stat, i) => (
                <div key={i} className="flex items-center gap-5 group">
                  <div className={`h-14 w-14 rounded-2xl bg-white border border-surface-border/50 flex items-center justify-center shadow-sm group-hover:shadow-md transition-shadow ${stat.color}`}>
                    <stat.icon className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-3xl md:text-4xl font-black tracking-tighter text-text-main">{stat.value}</p>
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-text-light mt-1">{stat.label}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Trusted By Section */}
      <section className="border-y border-surface-border py-16 md:py-20 bg-surface-alt/20">
        <div className="container">
          <div className="flex flex-col lg:flex-row items-center gap-16 lg:gap-32 overflow-hidden">
            <div className="shrink-0 text-center lg:text-left">
              <p className="text-[9px] font-bold uppercase tracking-[0.4em] text-text-muted mb-1">Elite Infrastructure</p>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-text-main whitespace-nowrap">Powering Top Teams</p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:flex lg:flex-wrap justify-center lg:justify-between items-center gap-x-20 gap-y-12 flex-grow">
              {['TECHNEXUS', 'LAGOSHUB', 'SAFARIPAY', 'KIGALIDIGITAL', 'ACCRACLOUD'].map(logo => (
                <div key={logo} className="font-black text-xl tracking-tighter text-text-main grayscale opacity-40 hover:grayscale-0 hover:opacity-100 transition-all duration-500 cursor-default select-none">
                  {logo}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 md:py-28 xl:py-32">
        <div className="container">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-16 mb-32 items-end">
            <div className="lg:col-span-7 animate-in slide-in-from-bottom duration-1000">
              <span className="text-primary font-black text-xs uppercase tracking-[0.2em] mb-6 block">The JobWahala Edge</span>
              <h2 className="mb-0 text-5xl md:text-[72px] font-black tracking-tighter text-text-main leading-[0.9]">Engineered for <br/><span className="text-primary italic">Excellence.</span></h2>
            </div>
            <div className="lg:col-span-5 lg:pb-2 animate-in slide-in-from-bottom duration-1000 delay-200">
              <p className="text-text-muted text-xl leading-relaxed font-medium border-l-2 border-primary/20 pl-10 py-2">Connecting elite talent with global opportunities through AI-powered precision and local context. We've built the infrastructure for the next generation of African professionals.</p>
            </div>
          </div>
          
          <div className="grid grid-cols-1 gap-10 md:grid-cols-3">
            {[
              { icon: Briefcase, color: 'primary', title: 'Smart AI Matching', desc: 'Our proprietary AI skips the noise, matching your specific skill set with companies that actually need them.', offset: 'lg:mt-0' },
              { icon: Users, color: 'secondary', title: 'Verified Freelancers', desc: "Access a curated marketplace of Africa's top independent professionals, already vetted for quality and reliability.", offset: 'lg:mt-12' },
              { icon: Shield, color: 'accent', title: 'Secure Infrastructure', desc: "From messaging to payments, we've built a secure environment that ensures trust between employers and talent.", offset: 'lg:mt-24' }
            ].map((f, i) => (
              <div key={i} className={`card group hover:scale-[1.02] shadow-premium-lg border-surface-border/50 relative overflow-hidden ${f.offset}`}>
                <div className="absolute -right-8 -top-8 h-32 w-32 bg-surface-alt/50 rounded-full group-hover:scale-150 transition-transform duration-700 -z-0"></div>
                <div className="relative z-10">
                  <div className={`mb-10 h-16 w-16 flex items-center justify-center bg-white border border-surface-border rounded-2xl group-hover:bg-primary group-hover:text-white group-hover:border-primary transition-all shadow-sm`}>
                    <f.icon className="h-8 w-8" />
                  </div>
                  <h3 className="mb-6 text-3xl font-black tracking-tighter text-text-main group-hover:text-primary transition-colors">{f.title}</h3>
                  <p className="text-text-muted text-lg leading-relaxed font-medium">
                    {f.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Recent Jobs Section — Dynamic */}
      {recentJobs.length > 0 && (
        <section className="py-20 md:py-24 bg-surface/30">
          <div className="container">
            <div className="flex flex-col md:flex-row justify-between items-end mb-12 gap-6">
              <div className="max-w-xl">
                <span className="text-primary font-bold text-sm uppercase tracking-wider mb-2 block">Live Openings</span>
                <h2 className="text-4xl font-bold mb-4">Just Posted</h2>
                <p className="text-text-muted text-lg leading-relaxed">Fresh opportunities from companies hiring right now. Updated in real-time from our live job feed.</p>
              </div>
              <Link to="/jobs" className="btn btn-outline border-primary text-primary px-8 flex items-center gap-2 group">
                View All Jobs <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>

            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
              {recentJobs.slice(0, 6).map((job) => (
                <Link
                  key={job.id}
                  to={`/jobs/${job.id}`}
                  className="card border-none bg-white p-7 hover:shadow-2xl hover:shadow-primary/8 transition-all group relative overflow-hidden"
                >
                  <div className="absolute top-0 right-0 h-20 w-20 bg-primary/3 rounded-full -mr-10 -mt-10 group-hover:bg-primary/8 transition-colors"></div>
                  <div className="relative z-10">
                    <div className="flex items-start justify-between gap-3 mb-4">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-lg text-text-main truncate group-hover:text-primary transition-colors">{job.title}</h3>
                        <p className="text-text-muted text-sm font-medium mt-1">{job.companyName}</p>
                      </div>
                      <span className="text-[9px] font-black uppercase tracking-widest text-text-light bg-surface-alt px-2.5 py-1 rounded-lg shrink-0">
                        {timeAgo(job.createdAt)}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-text-muted mb-5">
                      {job.location && (
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" /> {job.location}
                        </span>
                      )}
                      {job.type && (
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" /> {job.type}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between pt-4 border-t border-surface-border/50">
                      {job.salary ? (
                        <span className="text-sm font-black text-primary">{job.salary}</span>
                      ) : (
                        <span className="text-xs text-text-light">Salary not disclosed</span>
                      )}
                      {job.category && (
                        <span className="px-2.5 py-1 bg-surface rounded-lg text-[10px] font-bold text-text-muted uppercase tracking-wider">{job.category}</span>
                      )}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Featured Freelancers Section — Dynamic */}
      <section className="py-20 md:py-24 bg-surface/30">
        <div className="container">
          <div className="flex flex-col md:flex-row justify-between items-end mb-12 gap-6">
            <div className="max-w-xl">
              <span className="text-secondary font-bold text-sm uppercase tracking-wider mb-2 block">Top Rated Talent</span>
              <h2 className="text-4xl font-bold mb-4">Hire the Best Freelancers</h2>
              <p className="text-text-muted text-lg leading-relaxed">From developers to digital marketers, connect with pre-vetted professionals ready to scale your business.</p>
            </div>
            <Link to="/freelancers" className="btn btn-outline border-secondary text-secondary px-8 flex items-center gap-2 group">
              Browse All Gigs <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>

          <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
            {(topFreelancers.length > 0
              ? topFreelancers.slice(0, 3).map((f) => ({
                  id: f.id,
                  name: f.name,
                  role: f.skills[0] ? `${f.skills[0]} Specialist` : 'Freelancer',
                  rating: f.rating,
                  reviews: f.reviewCount,
                  skills: f.skills,
                  avatar: f.initials,
                  hourlyRate: f.hourlyRate,
                }))
              : [
                  { id: '1', name: 'Aisha Bello', role: 'Full Stack Developer', rating: 4.9, reviews: 124, skills: ['React', 'Node.js'], avatar: 'AB', hourlyRate: null },
                  { id: '2', name: 'Samuel Okoro', role: 'Graphic Designer', rating: 4.8, reviews: 89, skills: ['Figma', 'Branding'], avatar: 'SO', hourlyRate: null },
                  { id: '3', name: 'Fatima Zahra', role: 'Content Writer', rating: 5.0, reviews: 56, skills: ['SEO', 'Copywriting'], avatar: 'FZ', hourlyRate: null },
                ]
            ).map((freelancer) => (
              <div key={freelancer.id} className="card border-none bg-white p-8 hover:shadow-2xl hover:shadow-secondary/10 transition-all group relative overflow-hidden">
                <div className="absolute top-0 right-0 h-24 w-24 bg-secondary/5 rounded-full -mr-12 -mt-12 group-hover:bg-secondary/10 transition-colors"></div>
                
                <div className="flex items-center gap-4 mb-6 relative z-10">
                  <div className="h-16 w-16 bg-gradient-to-br from-secondary to-secondary-dark rounded-2xl flex items-center justify-center text-white font-black text-2xl shadow-lg">
                    {freelancer.avatar}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-bold text-lg text-text-main">{freelancer.name}</h3>
                      <VerifiedBadge type="freelancer" showText={false} />
                    </div>
                    <p className="text-secondary font-bold text-xs">{freelancer.role}</p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 mb-6">
                  {freelancer.skills.map(skill => (
                    <span key={skill} className="px-3 py-1 bg-surface rounded-lg text-xs font-bold text-text-muted">{skill}</span>
                  ))}
                </div>

                <div className="flex items-center justify-between pt-6 border-t border-surface-border">
                  <div className="flex items-center gap-1.5">
                    <Star className="h-4 w-4 text-accent fill-accent" />
                    <span className="font-black text-sm text-text-main">{freelancer.rating || '—'}</span>
                    <span className="text-xs text-text-light font-medium">({freelancer.reviews})</span>
                  </div>
                  <Link to={`/freelancers/${freelancer.id}`} className="btn btn-ghost btn-sm text-secondary font-black uppercase tracking-widest flex items-center gap-1 group/link">
                    View Profile <ArrowRight className="h-3 w-3 group-hover/link:translate-x-0.5 transition-transform" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative overflow-hidden py-20 md:py-28 xl:py-32">
        <div className="container relative z-10 px-4">
          <div className="bg-text-main rounded-[4rem] p-16 md:p-32 relative overflow-hidden group shadow-premium-2xl animate-in fade-in slide-in-from-bottom duration-1000">
            <div className="absolute top-0 right-0 h-full w-1/2 bg-gradient-to-l from-sky-400/20 to-transparent z-0"></div>
            <div className="absolute -bottom-24 -right-24 h-96 w-96 bg-sky-400/10 rounded-full blur-3xl group-hover:bg-sky-400/20 transition-all duration-1000"></div>
            
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-16 items-center relative z-10">
              <div className="lg:col-span-8 text-left">
                <h2 className="mb-10 text-5xl md:text-[88px] font-black tracking-tighter text-white leading-[0.9]">Ready to take the <br /><span className="text-sky-400 italic">next step?</span></h2>
                <p className="mb-14 text-xl text-white/70 max-w-xl font-medium leading-relaxed">
                  Join {counts ? `${formatCount(counts.totalTalent)} professionals` : 'thousands of professionals'} and employers already building the future of African excellence on JobWahala.
                </p>
                <div className="flex flex-wrap gap-8">
                  <Link to="/onboarding?role=seeker" className="btn btn-primary btn-lg px-12 shadow-primary/30 hover:scale-[1.02]">
                    Find a Job <ArrowRight className="h-6 w-6" />
                  </Link>
                  <Link to="/onboarding?role=employer" className="btn bg-white/10 text-white border border-white/20 px-12 btn-lg hover:bg-white/20">
                    Hire Talent
                  </Link>
                </div>
              </div>
              <div className="hidden lg:block lg:col-span-4 relative h-64">
                <div className="absolute inset-0 bg-sky-400/5 rounded-[3rem] blur-2xl animate-pulse"></div>
                <div className="absolute bottom-0 right-0 h-48 w-48 bg-white/5 rounded-3xl rotate-12 border border-white/10 backdrop-blur-3xl"></div>
                <div className="absolute top-0 left-10 h-32 w-32 bg-sky-400/20 rounded-[2rem] -rotate-12 border border-sky-400/20 backdrop-blur-2xl"></div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
