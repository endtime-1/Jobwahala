import { useState } from 'react'
import { Link, useSearchParams, useNavigate } from 'react-router-dom'
import { Rocket, Lock, ShieldCheck, Zap, CheckCircle, XCircle } from 'lucide-react'
import { apiResetPassword } from '../lib/api'

type ResetState = 'form' | 'success' | 'error'

export default function ResetPassword() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const token = searchParams.get('token')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [state, setState] = useState<ResetState>(token ? 'form' : 'error')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (password.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    if (!token) {
      setState('error')
      return
    }

    setIsLoading(true)
    try {
      await apiResetPassword(token, password)
      setState('success')
    } catch (err: any) {
      const msg = err?.message || 'Failed to reset password'
      if (msg.toLowerCase().includes('expired') || msg.toLowerCase().includes('invalid') || msg.toLowerCase().includes('already been used')) {
        setError(msg)
      } else {
        setError(msg)
      }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="auth-dark relative flex min-h-screen items-center justify-center overflow-hidden bg-text-main px-4 py-[calc(env(safe-area-inset-top)+1rem)] sm:px-6 lg:py-0">
      {/* Animated Background */}
      <div className="absolute inset-0 bg-primary/10 mix-blend-overlay z-0"></div>
      <div className="absolute top-[10%] left-[20%] w-[800px] h-[800px] bg-primary/20 rounded-full blur-[120px] mix-blend-screen animate-pulse z-0 pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[10%] w-[600px] h-[600px] bg-secondary/30 rounded-full blur-[100px] mix-blend-screen z-0 pointer-events-none" style={{ animation: 'pulse 8s cubic-bezier(0.4, 0, 0.6, 1) infinite' }}></div>
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-transparent via-text-main/80 to-text-main z-0 pointer-events-none"></div>

      <div className="relative z-10 w-full max-w-md animate-in slide-in-from-bottom duration-700">
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-3 group">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/30 bg-primary/20 shadow-primary/20 transition-all group-hover:-rotate-12 group-hover:bg-primary">
              <Rocket className="h-6 w-6 text-white" />
            </div>
            <span className="text-3xl font-black tracking-tighter text-white">Job<span className="text-primary drop-shadow-[0_0_15px_rgba(var(--color-primary),0.5)]">Wahala</span></span>
          </Link>
        </div>

        <div className="relative overflow-hidden rounded-[2rem] border border-white/20 bg-white/10 p-8 shadow-[0_0_50px_rgba(0,0,0,0.3)] shadow-primary/10 backdrop-blur-3xl sm:p-10">
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary/20 rounded-full blur-[80px] -mr-32 -mt-32 mix-blend-screen opacity-50 z-0"></div>

          <div className="relative z-10">
            {state === 'form' && (
              <div className="space-y-6">
                <div className="text-center">
                  <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-white/80 backdrop-blur-md shadow-inner mb-4">
                    <Zap className="h-3.5 w-3.5 text-primary" /> New Security Key
                  </div>
                  <h1 className="text-3xl font-black tracking-tighter text-white mb-3">
                    New <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary via-secondary to-primary animate-gradient bg-[length:200%_auto]">Password</span>
                  </h1>
                  <p className="text-white/60 font-medium text-sm">
                    Choose a strong password with at least 8 characters.
                  </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                  <div className="relative group/input">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-white/60 mb-2 block group-focus-within/input:text-white transition-colors">New Security Key</label>
                    <div className="relative">
                      <Lock className="absolute left-5 top-1/2 -translate-y-1/2 h-5 w-5 text-white/40 group-focus-within/input:text-primary transition-colors z-10" />
                      <input
                        type="password"
                        placeholder="Minimum 8 characters"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="h-16 w-full rounded-2xl border border-white/10 bg-white/5 pl-14 pr-6 font-bold text-white placeholder:text-white/30 outline-none transition-all focus:border-primary/50 focus:bg-white/10 focus:ring-4 focus:ring-primary/20"
                        required
                        minLength={8}
                        autoFocus
                      />
                    </div>
                  </div>

                  <div className="relative group/input">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-white/60 mb-2 block group-focus-within/input:text-white transition-colors">Confirm Security Key</label>
                    <div className="relative">
                      <ShieldCheck className="absolute left-5 top-1/2 -translate-y-1/2 h-5 w-5 text-white/40 group-focus-within/input:text-primary transition-colors z-10" />
                      <input
                        type="password"
                        placeholder="Re-enter password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="h-16 w-full rounded-2xl border border-white/10 bg-white/5 pl-14 pr-6 font-bold text-white placeholder:text-white/30 outline-none transition-all focus:border-primary/50 focus:bg-white/10 focus:ring-4 focus:ring-primary/20"
                        required
                        minLength={8}
                      />
                    </div>
                  </div>

                  {/* Password strength indicator */}
                  {password && (
                    <div className="space-y-2">
                      <div className="flex gap-1.5">
                        {[1, 2, 3, 4].map((level) => (
                          <div
                            key={level}
                            className={`h-1.5 flex-1 rounded-full transition-colors ${
                              password.length >= level * 3
                                ? level <= 1
                                  ? 'bg-red-400'
                                  : level <= 2
                                    ? 'bg-yellow-400'
                                    : level <= 3
                                      ? 'bg-blue-400'
                                      : 'bg-emerald-400'
                                : 'bg-white/10'
                            }`}
                          />
                        ))}
                      </div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-white/40">
                        {password.length < 4 ? 'Weak' : password.length < 7 ? 'Fair' : password.length < 10 ? 'Good' : 'Strong'}
                      </p>
                    </div>
                  )}

                  {error && (
                    <p className="text-red-400 text-sm font-semibold text-center bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">{error}</p>
                  )}

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="group/btn flex h-16 w-full items-center justify-center gap-3 rounded-2xl bg-primary font-black uppercase tracking-widest text-white shadow-[0_0_30px_rgba(var(--color-primary),0.3)] shadow-primary/40 transition-all hover:scale-[1.02] hover:bg-white hover:text-text-main hover:shadow-primary/60 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isLoading ? 'Resetting...' : 'Reset Password'}
                  </button>
                </form>
              </div>
            )}

            {state === 'success' && (
              <div className="text-center space-y-6">
                <div className="flex justify-center">
                  <div className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500/20 border border-emerald-500/30">
                    <CheckCircle className="h-10 w-10 text-emerald-400" />
                  </div>
                </div>
                <div>
                  <h1 className="text-2xl font-black text-white mb-2">Password Reset!</h1>
                  <p className="text-white/60 font-medium text-sm">
                    Your password has been successfully reset. You can now log in with your new password.
                  </p>
                </div>
                <button
                  onClick={() => navigate('/login')}
                  className="flex h-14 w-full items-center justify-center gap-3 rounded-2xl bg-primary font-black uppercase tracking-widest text-white text-sm shadow-primary/40 transition-all hover:scale-[1.02] hover:bg-white hover:text-text-main"
                >
                  Go to Login
                </button>
              </div>
            )}

            {state === 'error' && !token && (
              <div className="text-center space-y-6">
                <div className="flex justify-center">
                  <div className="flex h-20 w-20 items-center justify-center rounded-full bg-red-500/20 border border-red-500/30">
                    <XCircle className="h-10 w-10 text-red-400" />
                  </div>
                </div>
                <div>
                  <h1 className="text-2xl font-black text-white mb-2">Invalid Link</h1>
                  <p className="text-white/60 font-medium text-sm">
                    This password reset link is invalid. Please request a new one.
                  </p>
                </div>
                <div className="space-y-3">
                  <Link
                    to="/forgot-password"
                    className="flex h-14 w-full items-center justify-center rounded-2xl bg-primary font-black uppercase tracking-widest text-white text-sm shadow-primary/40 transition-all hover:scale-[1.02] hover:bg-white hover:text-text-main"
                  >
                    Request New Link
                  </Link>
                  <Link
                    to="/login"
                    className="flex h-12 w-full items-center justify-center rounded-2xl bg-white/5 border border-white/10 font-black uppercase tracking-widest text-white text-[10px] hover:bg-white/10 transition-all"
                  >
                    Back to Login
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
