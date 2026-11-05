import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Mail, Lock, Eye, EyeOff, ArrowRight } from 'lucide-react'
import { AuthAside, AuthMobileBanner } from '../components/AuthShell'
import PhoneCodeFlow from '../components/PhoneCodeFlow'
import { useAuth } from '../context/AuthContext'
import { isApiUnavailableMessage } from '../lib/apiStatus'
import { getErrorMessage } from '../lib/errors'

export default function Login() {
  const [method, setMethod] = useState<'email' | 'phone'>('email')
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
    } catch (err) {
      const nextMessage = getErrorMessage(err, 'Login failed. Please try again.')
      setError(isApiUnavailableMessage(nextMessage) ? '' : nextMessage)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="v2 flex min-h-screen">
      <AuthAside
        headline="Your next job is"
        accent="closer than you think."
        points={['Real jobs from employers you can check', 'See pay and location before you apply', 'Track every application in one place']}
      />
      {/* Right panel */}
      <div className="flex flex-1 flex-col bg-[#f7f9fc]">
        <AuthMobileBanner linkTo="/signup" linkLabel="Sign up free" tagline="Welcome back." />

        <div className="flex flex-1 flex-col justify-center px-4 py-8 sm:px-10 sm:py-12">
          <div className="w-full max-w-[400px] mx-auto">
            {/* Card */}
            <div className="bg-white rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.06)] border border-[#e8eef5] p-5 sm:p-8">
              <div className="mb-7">
                <h1 className="text-3xl font-black tracking-tight text-[#111c2d] mb-1">Welcome back</h1>
                <p className="text-base text-[#6b7a8d]">Sign in to continue to your account</p>
              </div>

              <div role="tablist" aria-label="How to sign in" className="mb-5 grid grid-cols-2 rounded-xl bg-[#eaeff5] p-1">
                {(
                  [
                    ['email', 'Email'],
                    ['phone', 'Phone'],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    role="tab"
                    aria-selected={method === value}
                    onClick={() => { setMethod(value); setError('') }}
                    className={`h-10 rounded-lg text-sm font-bold transition-all ${method === value ? 'bg-white text-[#111c2d] shadow-sm' : 'text-[#6b7a8d] hover:text-[#111c2d]'}`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {method === 'phone' ? (
                <PhoneCodeFlow mode="login" onDone={() => navigate('/dashboard')} />
              ) : (
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
                      className="w-full h-[50px] pl-10 pr-4 rounded-xl border border-[#dde3ec] bg-[#f7f9fc] text-base text-[#111c2d] placeholder:text-[#9caab8] outline-none transition-all focus:bg-white focus:border-[#2f6df6] focus:ring-3 focus:ring-[#2f6df6]/10"
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
                      className="w-full h-[50px] pl-10 pr-10 rounded-xl border border-[#dde3ec] bg-[#f7f9fc] text-base text-[#111c2d] placeholder:text-[#9caab8] outline-none transition-all focus:bg-white focus:border-[#2f6df6] focus:ring-3 focus:ring-[#2f6df6]/10"
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
                  className="btn btn-gold btn-lg mt-1 w-full justify-center disabled:cursor-not-allowed disabled:opacity-60"
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
              )}
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
