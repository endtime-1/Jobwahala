import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Mail, Lock, User, Eye, EyeOff, ArrowRight, Briefcase, Laptop, Users } from 'lucide-react'
import { useAuth, type UserRole } from '../context/AuthContext'
import { isApiUnavailableMessage } from '../lib/apiStatus'

const ROLES: { value: UserRole; label: string; description: string; icon: typeof Briefcase }[] = [
  { value: 'SEEKER', label: 'Job Seeker', description: 'Find employment', icon: Users },
  { value: 'EMPLOYER', label: 'Employer', description: 'Hire talent', icon: Briefcase },
  { value: 'FREELANCER', label: 'Freelancer', description: 'Offer services', icon: Laptop },
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
    } catch (err: any) {
      const nextMessage = err?.message || 'Signup failed. Please try again.'
      setError(isApiUnavailableMessage(nextMessage) ? '' : nextMessage)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen">
      {/* Left panel */}
      <div className="hidden lg:flex lg:w-[52%] flex-col justify-between p-14 relative overflow-hidden bg-[#0d1829]">
        {/* Gradient orbs */}
        <div className="absolute top-[-100px] left-[-60px] w-[380px] h-[380px] rounded-full bg-[#2f6df6]/20 blur-[80px] pointer-events-none" />
        <div className="absolute bottom-[-60px] right-[-80px] w-[320px] h-[320px] rounded-full bg-[#2f6df6]/10 blur-[60px] pointer-events-none" />
        {/* Dot grid */}
        <div
          className="absolute inset-0 opacity-[0.04] pointer-events-none"
          style={{ backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)', backgroundSize: '28px 28px' }}
        />

        <Link to="/" className="relative z-10 flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-xl bg-[#2f6df6] flex items-center justify-center shadow-lg shadow-[#2f6df6]/30">
            <Briefcase className="h-4 w-4 text-white" strokeWidth={2.5} />
          </div>
          <span className="text-xl font-bold tracking-tight text-white">
            Job<span className="text-[#2f6df6]">Wahala</span>
          </span>
        </Link>

        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 rounded-full bg-[#2f6df6]/15 border border-[#2f6df6]/20 px-3.5 py-1.5 mb-6">
            <span className="h-1.5 w-1.5 rounded-full bg-[#2f6df6] animate-pulse" />
            <span className="text-xs font-semibold text-[#2f6df6]">Free to join — no hidden fees</span>
          </div>
          <h2 className="text-[42px] font-bold leading-[1.15] text-white mb-4">
            Start your journey<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#2f6df6] to-[#6fa0ff]">
              today.
            </span>
          </h2>
          <p className="text-[#7a8fa8] text-base leading-relaxed max-w-xs">
            Join thousands of professionals and employers already using JobWahala to find work, hire talent, and grow their careers.
          </p>

          <div className="mt-10 space-y-3">
            {[
              'Verified employers and freelancers',
              'Secure payments via Paystack',
              'Post jobs and services for free',
              'Built for Ghana, open to the world',
            ].map((item) => (
              <div key={item} className="flex items-center gap-3 text-sm text-[#7a8fa8]">
                <div className="h-5 w-5 rounded-full bg-[#2f6df6]/15 border border-[#2f6df6]/25 flex items-center justify-center shrink-0">
                  <div className="h-1.5 w-1.5 rounded-full bg-[#2f6df6]" />
                </div>
                {item}
              </div>
            ))}
          </div>
        </div>

        <p className="relative z-10 text-xs text-[#3d4f63]">© {new Date().getFullYear()} JobWahala. All rights reserved.</p>
      </div>

      {/* Right panel */}
      <div className="flex flex-1 flex-col bg-[#f7f9fc]">
        {/* Mobile header */}
        <div className="lg:hidden flex items-center justify-between px-4 pt-6 pb-2">
          <Link to="/" className="text-xl font-bold tracking-tight text-[#101a2b]">
            Job<span className="text-[#2f6df6]">Wahala</span>
          </Link>
          <Link to="/login" className="text-sm text-[#2f6df6] font-semibold">
            Sign in
          </Link>
        </div>

        <div className="flex flex-1 flex-col justify-start sm:justify-center px-4 py-6 sm:px-10 sm:py-12 overflow-y-auto">
          <div className="w-full max-w-[400px] mx-auto">
            {/* Card */}
            <div className="bg-white rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.06)] border border-[#e8eef5] p-5 sm:p-8">
              <div className="mb-7">
                <h1 className="text-[22px] font-bold text-[#111c2d] mb-1">Create your account</h1>
                <p className="text-sm text-[#6b7a8d]">Get started — it only takes a minute</p>
              </div>

              <form onSubmit={handleSignup} className="space-y-4">
                {/* Full name */}
                <div>
                  <label className="block text-[13px] font-semibold text-[#374151] mb-1.5">Full name</label>
                  <div className="relative">
                    <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#9caab8]" />
                    <input
                      type="text"
                      placeholder="Kwame Mensah"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full h-[44px] pl-10 pr-4 rounded-xl border border-[#dde3ec] bg-[#f7f9fc] text-sm text-[#111c2d] placeholder:text-[#9caab8] outline-none transition-all focus:bg-white focus:border-[#2f6df6] focus:ring-3 focus:ring-[#2f6df6]/10"
                      required
                      autoComplete="name"
                    />
                  </div>
                </div>

                {/* Email */}
                <div>
                  <label className="block text-[13px] font-semibold text-[#374151] mb-1.5">Email address</label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#9caab8]" />
                    <input
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full h-[44px] pl-10 pr-4 rounded-xl border border-[#dde3ec] bg-[#f7f9fc] text-sm text-[#111c2d] placeholder:text-[#9caab8] outline-none transition-all focus:bg-white focus:border-[#2f6df6] focus:ring-3 focus:ring-[#2f6df6]/10"
                      required
                      autoComplete="email"
                    />
                  </div>
                </div>

                {/* Password */}
                <div>
                  <label className="block text-[13px] font-semibold text-[#374151] mb-1.5">Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#9caab8]" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      placeholder="At least 8 characters"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full h-[44px] pl-10 pr-10 rounded-xl border border-[#dde3ec] bg-[#f7f9fc] text-sm text-[#111c2d] placeholder:text-[#9caab8] outline-none transition-all focus:bg-white focus:border-[#2f6df6] focus:ring-3 focus:ring-[#2f6df6]/10"
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
                  <label className="block text-[13px] font-semibold text-[#374151] mb-2">I am a…</label>
                  <div className="grid grid-cols-3 gap-2">
                    {ROLES.map(({ value, label, description, icon: Icon }) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setRole(value)}
                        className={`relative flex flex-col items-center gap-2 rounded-xl border p-3.5 text-center transition-all ${
                          role === value
                            ? 'border-[#2f6df6] bg-[#edf4ff] shadow-sm shadow-[#2f6df6]/10'
                            : 'border-[#dde3ec] bg-[#f7f9fc] hover:border-[#b8c8dc] hover:bg-white'
                        }`}
                      >
                        {role === value && (
                          <div className="absolute top-2 right-2 h-2 w-2 rounded-full bg-[#2f6df6]" />
                        )}
                        <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${role === value ? 'bg-[#2f6df6]/15' : 'bg-[#eaeff5]'}`}>
                          <Icon className={`h-4 w-4 ${role === value ? 'text-[#2f6df6]' : 'text-[#6b7a8d]'}`} />
                        </div>
                        <div>
                          <p className={`text-[12px] font-semibold leading-tight ${role === value ? 'text-[#2f6df6]' : 'text-[#374151]'}`}>{label}</p>
                          <p className="text-[10px] text-[#9caab8] mt-0.5 leading-tight">{description}</p>
                        </div>
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
                  className="w-full h-[44px] mt-1 rounded-xl bg-gradient-to-r from-[#2f6df6] to-[#4d85ff] text-white text-sm font-semibold flex items-center justify-center gap-2 shadow-md shadow-[#2f6df6]/20 hover:shadow-lg hover:shadow-[#2f6df6]/30 hover:brightness-105 transition-all active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
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
