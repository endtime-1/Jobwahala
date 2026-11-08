import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Briefcase, ChevronRight, Rocket, Shield, User } from 'lucide-react'
import Logo from '../components/Logo'
import PageHero from '../components/PageHero'
import { useAuth, type AuthUser, type UserRole } from '../context/AuthContext'
import { apiAttachReferral, apiUpdateProfile } from '../lib/api'
import { takeReferral } from '../lib/growth'
import { getErrorMessage } from '../lib/errors'

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

  // A new employer who came from a referral link: tell the server who referred them (once; a wrong or late code is simply ignored).
  useEffect(() => {
    if (activeRole !== 'EMPLOYER') return
    const code = takeReferral()
    if (code) void apiAttachReferral(code).catch(() => undefined)
  }, [activeRole])

  const handleSubmit = async () => {
    setError('')
    setIsSubmitting(true)

    try {
      await apiUpdateProfile(payload)
      await refreshUser()
      navigate('/dashboard')
    } catch (err) {
      setError(getErrorMessage(err, 'Unable to save your profile right now.'))
    } finally {
      setIsSubmitting(false)
    }
  }

  const isEmployer = activeRole === 'EMPLOYER'

  return (
    <div className="v2 min-h-screen">
      <div className="relative bg-primary text-white">
        <div className="heritage-strip absolute inset-x-0 top-0" aria-hidden />
        <div className="container flex items-center justify-between py-5">
          <Logo tone="dark" size={34} />
          <p className="text-sm font-bold text-white/80">Step 2 of 2</p>
        </div>
      </div>

      <div className="container max-w-3xl pb-20 pt-8 sm:pt-10">
        <PageHero eyebrow={content.badge} title={content.title}>
          <p className="mt-4 max-w-xl text-base font-medium text-white/75 sm:text-lg">{content.description}</p>
          <div className="mt-6 max-w-sm">
            <div className="h-2 w-full rounded-full bg-white/15">
              <div className="h-2 w-1/2 rounded-full bg-gold" />
            </div>
            <p className="mt-2 text-sm font-semibold text-white/70">Account created. One quick step left.</p>
          </div>
        </PageHero>

        <div className="mt-6 space-y-6 rounded-2xl border border-surface-border bg-white p-5 sm:p-8">
          <div className="flex items-center gap-4 border-b border-surface-border pb-5">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-secondary/10 text-secondary">
              <content.icon className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-semibold text-text-muted">You are joining as</p>
              <p className="text-xl font-extrabold capitalize text-text-main">{activeRole.toLowerCase()}</p>
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="onboarding-primary" className="block text-base font-bold text-text-main">
              {content.primaryLabel}
            </label>
            {isEmployer ? (
              <input
                id="onboarding-primary"
                type="text"
                value={form.primary}
                onChange={(event) => setForm((current) => ({ ...current, primary: event.target.value }))}
                placeholder={content.primaryPlaceholder}
                className="h-14 text-base font-semibold"
              />
            ) : (
              <textarea
                id="onboarding-primary"
                value={form.primary}
                onChange={(event) => setForm((current) => ({ ...current, primary: event.target.value }))}
                placeholder={content.primaryPlaceholder}
                className="min-h-[140px] py-4 text-base font-semibold"
              />
            )}
          </div>

          <div className="space-y-2">
            <label htmlFor="onboarding-secondary" className="block text-base font-bold text-text-main">
              {content.secondaryLabel}
            </label>
            <input
              id="onboarding-secondary"
              type="text"
              value={form.secondary}
              onChange={(event) => setForm((current) => ({ ...current, secondary: event.target.value }))}
              placeholder={content.secondaryPlaceholder}
              className="h-14 text-base font-semibold"
            />
          </div>

          <div className="flex items-start gap-4 rounded-xl border border-success/25 bg-success/5 p-4">
            <Shield className="mt-0.5 h-6 w-6 flex-none text-success" />
            <div>
              <p className="font-extrabold text-text-main">Get verified later</p>
              <p className="mt-0.5 text-sm font-medium text-text-muted">
                After you sign in you can confirm your identity from your dashboard. Verified profiles earn more trust from employers and clients.
              </p>
            </div>
          </div>

          {error ? (
            <p className="rounded-xl border border-error/15 bg-error/5 px-4 py-3 text-sm font-semibold text-error">{error}</p>
          ) : null}

          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="btn btn-gold btn-lg w-full justify-center disabled:opacity-60"
          >
            {isSubmitting ? 'Saving...' : 'Continue to my dashboard'}
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  )
}
