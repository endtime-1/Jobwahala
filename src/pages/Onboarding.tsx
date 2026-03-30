import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Briefcase, ChevronRight, Rocket, Shield, User, Zap } from 'lucide-react'
import { useAuth, type AuthUser, type UserRole } from '../context/AuthContext'
import { apiUpdateProfile } from '../lib/api'

type ProfileFormState = {
  primary: string
  secondary: string
}

const roleCopy: Record<
  Exclude<UserRole, 'ADMIN'>,
  {
    icon: typeof User
    badge: string
    title: string
    description: string
    primaryLabel: string
    primaryPlaceholder: string
    secondaryLabel: string
    secondaryPlaceholder: string
  }
> = {
  SEEKER: {
    icon: User,
    badge: 'Job Seeker Setup',
    title: 'Complete your candidate profile',
    description: 'Add enough context for employers and platform matching to start working.',
    primaryLabel: 'Professional Summary',
    primaryPlaceholder: 'Frontend engineer with 4 years building React products...',
    secondaryLabel: 'Key Skills',
    secondaryPlaceholder: 'React, TypeScript, Tailwind, Testing',
  },
  EMPLOYER: {
    icon: Briefcase,
    badge: 'Employer Setup',
    title: 'Complete your company profile',
    description: 'Add the core details candidates need before they trust your job posts.',
    primaryLabel: 'Company Name',
    primaryPlaceholder: 'JobWahala Labs',
    secondaryLabel: 'Company Website',
    secondaryPlaceholder: 'https://example.com',
  },
  FREELANCER: {
    icon: Rocket,
    badge: 'Freelancer Setup',
    title: 'Complete your freelancer profile',
    description: 'Add your positioning so clients can understand what you offer immediately.',
    primaryLabel: 'Professional Bio',
    primaryPlaceholder: 'Product designer focused on fintech and marketplace UX systems...',
    secondaryLabel: 'Core Skills',
    secondaryPlaceholder: 'Figma, Design Systems, UX Research',
  },
}

const getInitialState = (role: Exclude<UserRole, 'ADMIN'>, user: AuthUser | null): ProfileFormState => {
  if (role === 'SEEKER') {
    return {
      primary: user?.jobSeekerProfile?.experience || '',
      secondary: user?.jobSeekerProfile?.skills || '',
    }
  }

  if (role === 'EMPLOYER') {
    return {
      primary: user?.employerProfile?.companyName === 'New Company' ? '' : user?.employerProfile?.companyName || '',
      secondary: user?.employerProfile?.website || '',
    }
  }

  return {
    primary: user?.freelancerProfile?.bio || '',
    secondary: user?.freelancerProfile?.skills || '',
  }
}

export default function Onboarding() {
  const { user, role, refreshUser } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState<ProfileFormState>({ primary: '', secondary: '' })
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const activeRole = (role || user?.role || 'SEEKER') as Exclude<UserRole, 'ADMIN'>
  const content = roleCopy[activeRole]

  useEffect(() => {
    if (!user) return
    setForm(getInitialState(activeRole, user))
  }, [activeRole, user])

  const payload = useMemo(() => {
    if (activeRole === 'SEEKER') {
      return {
        experience: form.primary.trim(),
        skills: form.secondary.trim(),
      }
    }

    if (activeRole === 'EMPLOYER') {
      return {
        companyName: form.primary.trim(),
        website: form.secondary.trim(),
      }
    }

    return {
      bio: form.primary.trim(),
      skills: form.secondary.trim(),
    }
  }, [activeRole, form.primary, form.secondary])

  const handleSubmit = async () => {
    setError('')
    setIsSubmitting(true)

    try {
      await apiUpdateProfile(payload)
      await refreshUser()
      navigate('/dashboard')
    } catch (err: any) {
      setError(err.message || 'Unable to save your profile right now.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="container animate-in fade-in slide-in-from-bottom-8 pt-24 pb-24 duration-700 md:pt-28 xl:pt-32">
      <div className="mx-auto max-w-4xl">
        <header className="dashboard-hero mb-8 px-5 py-6 text-center sm:px-7 sm:py-7 lg:px-8 lg:py-8 lg:text-left">
          <div className="relative z-10 flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <div className="dashboard-kicker mb-4 justify-center lg:justify-start">
                <Zap className="h-3.5 w-3.5" /> {content.badge}
              </div>
              <h1 className="mb-4 text-4xl font-black leading-tight tracking-tighter text-text-main md:text-5xl">
                {content.title}
              </h1>
              <p className="text-base font-medium tracking-tight text-text-muted md:text-lg">
                {content.description}
              </p>
            </div>

            <div className="dashboard-panel px-5 py-5 sm:min-w-[20rem] sm:px-6">
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <content.icon className="h-7 w-7" />
                </div>
                <div className="text-left">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-text-light">Active role</p>
                  <p className="mt-1 text-xl font-black tracking-tight text-text-main">{activeRole}</p>
                </div>
              </div>
            </div>
          </div>
        </header>

        <div className="dashboard-panel space-y-10 p-5 sm:p-7 lg:p-8">
            <div className="flex items-center gap-4 pb-6 border-b border-surface-border">
              <div className="h-14 w-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
                <content.icon className="h-7 w-7" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-text-light">Active Role</p>
                <p className="text-xl font-black text-text-main tracking-tight">{activeRole}</p>
              </div>
            </div>

            <div className="space-y-8">
              <div className="space-y-4">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-text-light block">
                  {content.primaryLabel}
                </label>
                <textarea
                  value={form.primary}
                  onChange={(event) => setForm((current) => ({ ...current, primary: event.target.value }))}
                  placeholder={content.primaryPlaceholder}
                  className="min-h-[150px] font-bold py-4"
                />
              </div>

              <div className="space-y-4">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-text-light block">
                  {content.secondaryLabel}
                </label>
                <input
                  type="text"
                  value={form.secondary}
                  onChange={(event) => setForm((current) => ({ ...current, secondary: event.target.value }))}
                  placeholder={content.secondaryPlaceholder}
                  className="h-16 font-bold"
                />
              </div>
            </div>

            <div className="rounded-3xl border border-surface-border bg-surface-alt/40 p-6">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-2xl bg-white flex items-center justify-center border border-surface-border shadow-sm">
                  <Shield className="h-6 w-6 text-text-light" />
                </div>
                <div className="flex-grow">
                  <p className="text-sm font-black text-text-main mb-1">Verification upload</p>
                  <p className="text-[11px] font-bold text-text-light">
                    Identity and document upload is not wired yet. Profile setup now saves the core backend fields first.
                  </p>
                </div>
              </div>
            </div>

            {error ? (
              <p className="text-sm font-semibold text-error bg-error/5 border border-error/10 rounded-2xl px-4 py-3">
                {error}
              </p>
            ) : null}

            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="btn btn-primary btn-lg w-full rounded-2xl shadow-primary/20 flex items-center justify-center gap-3 font-black uppercase tracking-widest py-6 disabled:opacity-60"
            >
              {isSubmitting ? 'Saving Profile...' : 'Access Workspace'}
              <ChevronRight className="h-6 w-6" />
            </button>
          </div>
        </div>
    </div>
  )
}
