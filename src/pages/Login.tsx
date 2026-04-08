import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Mail, Lock, Eye, EyeOff, Briefcase, Users, TrendingUp } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { isApiUnavailableMessage } from '../lib/apiStatus'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const navigate = useNavigate()
  const { login } = useAuth()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)
    try {
      await login(email, password)
      navigate('/dashboard')
    } catch (err: any) {
      const nextMessage = err?.message || 'Login failed. Please try again.'
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
            Ghana's job market,<br />all in one place.
          </h2>
          <p className="text-white/60 text-base leading-relaxed max-w-sm">
            Connect with top employers, find freelance gigs, or hire skilled professionals across Ghana and beyond.
          </p>

          <div className="mt-10 grid grid-cols-3 gap-4">
            {[
              { icon: Briefcase, label: 'Jobs Posted', value: '1,200+' },
              { icon: Users, label: 'Professionals', value: '8,500+' },
              { icon: TrendingUp, label: 'Placements', value: '3,400+' },
            ].map(({ icon: Icon, label, value }) => (
              <div key={label} className="rounded-xl bg-white/5 border border-white/10 p-4">
                <Icon className="h-5 w-5 text-[#2f6df6] mb-2" />
                <p className="text-xl font-bold">{value}</p>
                <p className="text-xs text-white/50 mt-0.5">{label}</p>
              </div>
            ))}
          </div>
        </div>

        <p className="text-xs text-white/30">© {new Date().getFullYear()} JobWahala. All rights reserved.</p>
      </div>

      {/* Right panel — form */}
      <div className="flex flex-1 flex-col justify-center px-6 py-12 sm:px-12 lg:px-16">
        {/* Mobile logo */}
        <div className="lg:hidden mb-10">
          <Link to="/" className="text-2xl font-bold tracking-tight text-[#101a2b]">
            Job<span className="text-[#2f6df6]">Wahala</span>
          </Link>
        </div>

        <div className="w-full max-w-sm mx-auto">
          <h1 className="text-2xl font-bold text-[#111c2d] mb-1">Welcome back</h1>
          <p className="text-sm text-[#536275] mb-8">Sign in to your account to continue</p>

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-[#111c2d] mb-1.5">
                Email address
              </label>
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

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-sm font-medium text-[#111c2d]">Password</label>
                <Link to="/forgot-password" className="text-xs text-[#2f6df6] hover:underline">
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#93a1b5]" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter your password"
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
              {isLoading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-[#536275]">
            Don't have an account?{' '}
            <Link to="/signup" className="text-[#2f6df6] font-medium hover:underline">
              Create one
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
