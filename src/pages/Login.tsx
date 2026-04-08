import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Mail, Lock, Eye, EyeOff, ArrowRight, Briefcase, Users, TrendingUp } from 'lucide-react'
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

  const handleLogin = async (e: { preventDefault(): void }) => {
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
    <div className="flex min-h-screen">
      {/* Left panel */}
      <div className="hidden lg:flex lg:w-[52%] flex-col justify-between p-14 relative overflow-hidden bg-[#0d1829]">
        {/* Gradient orb decorations */}
        <div className="absolute top-[-120px] right-[-80px] w-[400px] h-[400px] rounded-full bg-[#2f6df6]/20 blur-[80px] pointer-events-none" />
        <div className="absolute bottom-[-80px] left-[-60px] w-[300px] h-[300px] rounded-full bg-[#2f6df6]/10 blur-[60px] pointer-events-none" />
        {/* Dot grid */}
        <div
          className="absolute inset-0 opacity-[0.04] pointer-events-none"
          style={{ backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)', backgroundSize: '28px 28px' }}
        />

        <Link to="/" className="relative z-10 flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-xl bg-[#2f6df6] flex items-center justify-center shadow-lg shadow-[#2f6df6]/30">
            <Briefcase className="h-4.5 w-4.5 text-white" strokeWidth={2.5} />
          </div>
          <span className="text-xl font-bold tracking-tight text-white">
            Job<span className="text-[#2f6df6]">Wahala</span>
          </span>
        </Link>

        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 rounded-full bg-[#2f6df6]/15 border border-[#2f6df6]/20 px-3.5 py-1.5 mb-6">
            <span className="h-1.5 w-1.5 rounded-full bg-[#2f6df6] animate-pulse" />
            <span className="text-xs font-semibold text-[#2f6df6]">Ghana's #1 Job Platform</span>
          </div>
          <h2 className="text-[42px] font-bold leading-[1.15] text-white mb-4">
            Your next big<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#2f6df6] to-[#6fa0ff]">
              opportunity awaits.
            </span>
          </h2>
          <p className="text-[#7a8fa8] text-base leading-relaxed max-w-xs">
            Connect with top employers, find freelance gigs, or hire skilled professionals across Ghana and beyond.
          </p>

          <div className="mt-10 grid grid-cols-3 gap-3">
            {[
              { icon: Briefcase, label: 'Jobs', value: '1,200+' },
              { icon: Users, label: 'Professionals', value: '8,500+' },
              { icon: TrendingUp, label: 'Placements', value: '3,400+' },
            ].map(({ icon: Icon, label, value }) => (
              <div key={label} className="rounded-2xl bg-white/[0.04] border border-white/[0.07] p-4 hover:bg-white/[0.07] transition-colors">
                <Icon className="h-4 w-4 text-[#2f6df6] mb-3" />
                <p className="text-lg font-bold text-white">{value}</p>
                <p className="text-[11px] text-[#5a6a80] mt-0.5 font-medium">{label}</p>
              </div>
            ))}
          </div>
        </div>

        <p className="relative z-10 text-xs text-[#3d4f63]">© {new Date().getFullYear()} JobWahala. All rights reserved.</p>
      </div>

      {/* Right panel */}
      <div className="flex flex-1 flex-col bg-[#f7f9fc]">
        {/* Mobile header */}
        <div className="lg:hidden flex items-center justify-between px-6 pt-8 pb-2">
          <Link to="/" className="text-xl font-bold tracking-tight text-[#101a2b]">
            Job<span className="text-[#2f6df6]">Wahala</span>
          </Link>
          <Link to="/signup" className="text-sm text-[#2f6df6] font-semibold">
            Sign up
          </Link>
        </div>

        <div className="flex flex-1 items-center justify-center px-6 py-12 sm:px-10">
          <div className="w-full max-w-[400px]">
            {/* Card */}
            <div className="bg-white rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.06)] border border-[#e8eef5] p-8">
              <div className="mb-7">
                <h1 className="text-[22px] font-bold text-[#111c2d] mb-1">Welcome back</h1>
                <p className="text-sm text-[#6b7a8d]">Sign in to continue to your account</p>
              </div>

              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block text-[13px] font-semibold text-[#374151] mb-1.5">
                    Email address
                  </label>
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

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-[13px] font-semibold text-[#374151]">Password</label>
                    <Link to="/forgot-password" className="text-[12px] text-[#2f6df6] font-medium hover:underline">
                      Forgot password?
                    </Link>
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#9caab8]" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Enter your password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full h-[44px] pl-10 pr-10 rounded-xl border border-[#dde3ec] bg-[#f7f9fc] text-sm text-[#111c2d] placeholder:text-[#9caab8] outline-none transition-all focus:bg-white focus:border-[#2f6df6] focus:ring-3 focus:ring-[#2f6df6]/10"
                      required
                      autoComplete="current-password"
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
                      Signing in…
                    </span>
                  ) : (
                    <>Sign in <ArrowRight className="h-4 w-4" /></>
                  )}
                </button>
              </form>
            </div>

            <p className="mt-5 text-center text-[13px] text-[#6b7a8d]">
              Don't have an account?{' '}
              <Link to="/signup" className="text-[#2f6df6] font-semibold hover:underline">
                Create one free
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
