import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Mail, Lock, User, Eye, EyeOff, Briefcase, Users, Laptop } from 'lucide-react'
import { useAuth, type UserRole } from '../context/AuthContext'
import { isApiUnavailableMessage } from '../lib/apiStatus'

const ROLES: { value: UserRole; label: string; description: string; icon: typeof Briefcase }[] = [
  { value: 'SEEKER', label: 'Job Seeker', description: 'Looking for employment', icon: Users },
  { value: 'EMPLOYER', label: 'Employer', description: 'Hiring talent', icon: Briefcase },
  { value: 'FREELANCER', label: 'Freelancer', description: 'Offering services', icon: Laptop },
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

  const handleSignup = async (e: React.FormEvent) => {
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
    <div className="flex min-h-screen bg-white">
      {/* Left panel — brand */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12 bg-[#101a2b] text-white">
        <Link to="/" className="flex items-center gap-2">
          <span className="text-2xl font-bold tracking-tight">
            Job<span className="text-[#2f6df6]">Wahala</span>
          </span>
        </Link>

        <div>
          <h2 className="text-4xl font-bold leading-snug mb-4">
            Your next opportunity<br />starts here.
          </h2>
          <p className="text-white/60 text-base leading-relaxed max-w-sm">
            Join thousands of professionals and employers already using JobWahala to find work, hire talent, and grow their careers.
          </p>

          <div className="mt-10 space-y-3">
            {[
              'Free to join — no hidden fees',
              'Verified employers and freelancers',
              'Secure payments via Paystack',
              'Built for Ghana, open to the world',
            ].map((item) => (
              <div key={item} className="flex items-center gap-3 text-sm text-white/70">
                <div className="h-1.5 w-1.5 rounded-full bg-[#2f6df6] shrink-0" />
                {item}
              </div>
            ))}
          </div>
        </div>

        <p className="text-xs text-white/30">© {new Date().getFullYear()} JobWahala. All rights reserved.</p>
      </div>

      {/* Right panel — form */}
      <div className="flex flex-1 flex-col justify-center px-6 py-12 sm:px-12 lg:px-16 overflow-y-auto">
        {/* Mobile logo */}
        <div className="lg:hidden mb-10">
          <Link to="/" className="text-2xl font-bold tracking-tight text-[#101a2b]">
            Job<span className="text-[#2f6df6]">Wahala</span>
          </Link>
        </div>

        <div className="w-full max-w-sm mx-auto">
          <h1 className="text-2xl font-bold text-[#111c2d] mb-1">Create your account</h1>
          <p className="text-sm text-[#536275] mb-8">Get started — it only takes a minute</p>

          <form onSubmit={handleSignup} className="space-y-5">
            {/* Full name */}
            <div>
              <label className="block text-sm font-medium text-[#111c2d] mb-1.5">Full name</label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#93a1b5]" />
                <input
                  type="text"
                  placeholder="Kwame Mensah"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full h-11 pl-10 pr-4 rounded-lg border border-[#d1dae6] bg-white text-sm text-[#111c2d] placeholder:text-[#93a1b5] outline-none transition focus:border-[#2f6df6] focus:ring-2 focus:ring-[#2f6df6]/20"
                  required
                />
              </div>
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-[#111c2d] mb-1.5">Email address</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#93a1b5]" />
                <input
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full h-11 pl-10 pr-4 rounded-lg border border-[#d1dae6] bg-white text-sm text-[#111c2d] placeholder:text-[#93a1b5] outline-none transition focus:border-[#2f6df6] focus:ring-2 focus:ring-[#2f6df6]/20"
                  required
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-[#111c2d] mb-1.5">Password</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#93a1b5]" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="At least 8 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full h-11 pl-10 pr-10 rounded-lg border border-[#d1dae6] bg-white text-sm text-[#111c2d] placeholder:text-[#93a1b5] outline-none transition focus:border-[#2f6df6] focus:ring-2 focus:ring-[#2f6df6]/20"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#93a1b5] hover:text-[#536275] transition"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Role selector */}
            <div>
              <label className="block text-sm font-medium text-[#111c2d] mb-2">I am a…</label>
              <div className="grid grid-cols-3 gap-2">
                {ROLES.map(({ value, label, description, icon: Icon }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setRole(value)}
                    className={`flex flex-col items-center gap-1.5 rounded-lg border p-3 text-center transition ${
                      role === value
                        ? 'border-[#2f6df6] bg-[#edf4ff] text-[#2f6df6]'
                        : 'border-[#d1dae6] bg-white text-[#536275] hover:border-[#93a1b5]'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="text-xs font-semibold leading-tight">{label}</span>
                    <span className="text-[10px] leading-tight opacity-70 hidden sm:block">{description}</span>
                  </button>
                ))}
              </div>
            </div>

            {error && (
              <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full h-11 rounded-lg bg-[#2f6df6] text-white text-sm font-semibold transition hover:bg-[#1e4fd6] active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Creating account…' : 'Create account'}
            </button>

            <p className="text-xs text-center text-[#93a1b5]">
              By signing up, you agree to our{' '}
              <Link to="/terms" className="text-[#536275] underline hover:text-[#111c2d]">Terms</Link>{' '}
              and{' '}
              <Link to="/privacy" className="text-[#536275] underline hover:text-[#111c2d]">Privacy Policy</Link>.
            </p>
          </form>

          <p className="mt-6 text-center text-sm text-[#536275]">
            Already have an account?{' '}
            <Link to="/login" className="text-[#2f6df6] font-medium hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
