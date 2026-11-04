import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Mail, Lock, User, Eye, EyeOff, ArrowRight, Briefcase, Laptop, Users } from 'lucide-react'
import { AuthAside, AuthMobileBanner } from '../components/AuthShell'
import { useAuth, type UserRole } from '../context/AuthContext'
import { isApiUnavailableMessage } from '../lib/apiStatus'
import { getErrorMessage } from '../lib/errors'

const ROLES: { value: UserRole; label: string; description: string; icon: typeof Briefcase }[] = [
  { value: 'SEEKER', label: 'Job Seeker', description: 'I am looking for a job', icon: Users },
  { value: 'EMPLOYER', label: 'Employer', description: 'I want to hire people', icon: Briefcase },
  { value: 'FREELANCER', label: 'Freelancer', description: 'I sell my skills and services', icon: Laptop },
]

export default function Signup() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [role, setRole] = useState<UserRole>('SEEKER')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const navigate = useNavigate()
  const { signup } = useAuth()

  const handleSignup = async (e: { preventDefault(): void }) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)
    try {
      await signup(email, password, role)
      navigate('/onboarding')
    } catch (err) {
      const nextMessage = getErrorMessage(err, 'Signup failed. Please try again.')
      setError(isApiUnavailableMessage(nextMessage) ? '' : nextMessage)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="v2 flex min-h-screen">
      <AuthAside
        headline="Join free and"
        accent="get paid safely."
        points={['Free to join, no hidden fees', 'Employers with real company pages', 'See pay and location before you apply', 'Post jobs and review applicants free']}
      />
      {/* Right panel */}
      <div className="flex flex-1 flex-col bg-[#f7f9fc]">
        <AuthMobileBanner linkTo="/login" linkLabel="Sign in" tagline="Join free. Get paid safely." />

        <div className="flex flex-1 flex-col justify-start px-4 py-8 sm:justify-center sm:px-10 sm:py-12">
          <div className="w-full max-w-[400px] mx-auto">
            {/* Card */}
            <div className="bg-white rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.06)] border border-[#e8eef5] p-5 sm:p-8">
              <div className="mb-7">
                <h1 className="text-3xl font-black tracking-tight text-[#111c2d] mb-1">Create your account</h1>
                <p className="text-base text-[#6b7a8d]">Get started — it only takes a minute</p>
              </div>

              <form onSubmit={handleSignup} className="space-y-4">
                {/* Full name */}
                <div>
                  <label className="block text-sm font-bold text-[#374151] mb-1.5">Full name</label>
                  <div className="relative">
                    <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#9caab8]" />
                    <input
                      type="text"
                      placeholder="Kwame Mensah"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full h-[50px] pl-10 pr-4 rounded-xl border border-[#dde3ec] bg-[#f7f9fc] text-base text-[#111c2d] placeholder:text-[#9caab8] outline-none transition-all focus:bg-white focus:border-[#2f6df6] focus:ring-3 focus:ring-[#2f6df6]/10"
                      required
                      autoComplete="name"
                    />
                  </div>
                </div>

                {/* Email */}
                <div>
                  <label className="block text-sm font-bold text-[#374151] mb-1.5">Email address</label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#9caab8]" />
                    <input
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full h-[50px] pl-10 pr-4 rounded-xl border border-[#dde3ec] bg-[#f7f9fc] text-base text-[#111c2d] placeholder:text-[#9caab8] outline-none transition-all focus:bg-white focus:border-[#2f6df6] focus:ring-3 focus:ring-[#2f6df6]/10"
                      required
                      autoComplete="email"
                    />
                  </div>
                </div>

                {/* Password */}
                <div>
                  <label className="block text-sm font-bold text-[#374151] mb-1.5">Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#9caab8]" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      placeholder="At least 8 characters"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full h-[50px] pl-10 pr-10 rounded-xl border border-[#dde3ec] bg-[#f7f9fc] text-base text-[#111c2d] placeholder:text-[#9caab8] outline-none transition-all focus:bg-white focus:border-[#2f6df6] focus:ring-3 focus:ring-[#2f6df6]/10"
                      required
                      minLength={8}
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#9caab8] hover:text-[#6b7a8d] transition-colors"
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {/* Role selector */}
                <div>
                  <label className="block text-sm font-bold text-[#374151] mb-2">I am a…</label>
                  <div className="space-y-2.5">
                    {ROLES.map(({ value, label, description, icon: Icon }) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setRole(value)}
                        aria-pressed={role === value}
                        className={`flex w-full items-center gap-3.5 rounded-xl border-2 p-3.5 text-left transition-all ${
                          role === value
                            ? 'border-[#2f6df6] bg-[#edf4ff]'
                            : 'border-[#dde3ec] bg-[#f7f9fc] hover:border-[#b8c8dc] hover:bg-white'
                        }`}
                      >
                        <span className={`flex h-10 w-10 flex-none items-center justify-center rounded-lg ${role === value ? 'bg-[#2f6df6] text-white' : 'bg-[#eaeff5] text-[#6b7a8d]'}`}>
                          <Icon className="h-5 w-5" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className={`block text-base font-bold leading-tight ${role === value ? 'text-[#1e4fd6]' : 'text-[#111c2d]'}`}>{label}</span>
                          <span className="mt-0.5 block text-sm text-[#6b7a8d]">{description}</span>
                        </span>
                        <span className={`h-5 w-5 flex-none rounded-full border-2 ${role === value ? 'border-[#2f6df6] bg-[#2f6df6] shadow-[inset_0_0_0_3px_#edf4ff]' : 'border-[#c4cfdd]'}`} />
                      </button>
                    ))}
                  </div>
                </div>

                {error && (
                  <div className="flex items-start gap-2.5 rounded-xl bg-red-50 border border-red-100 px-3.5 py-3">
                    <div className="mt-0.5 h-1.5 w-1.5 rounded-full bg-red-400 shrink-0" />
                    <p className="text-[13px] text-red-600 leading-snug">{error}</p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isLoading}
                  className="btn btn-gold btn-lg mt-1 w-full justify-center disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isLoading ? (
                    <span className="flex items-center gap-2">
                      <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                      Creating account…
                    </span>
                  ) : (
                    <>Create account <ArrowRight className="h-4 w-4" /></>
                  )}
                </button>

                <p className="text-[11px] text-center text-[#9caab8] leading-relaxed">
                  By signing up, you agree to our{' '}
                  <Link to="/terms" className="text-[#6b7a8d] underline underline-offset-2 hover:text-[#111c2d]">Terms</Link>
                  {' '}and{' '}
                  <Link to="/privacy" className="text-[#6b7a8d] underline underline-offset-2 hover:text-[#111c2d]">Privacy Policy</Link>.
                </p>
              </form>
            </div>

            <p className="mt-5 text-center text-[13px] text-[#6b7a8d]">
              Already have an account?{' '}
              <Link to="/login" className="text-[#2f6df6] font-semibold hover:underline">
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
