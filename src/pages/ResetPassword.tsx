import { useState } from 'react'
import { Link, useSearchParams, useNavigate } from 'react-router-dom'
import { Lock, Eye, EyeOff, ArrowLeft, ArrowRight, CheckCircle, XCircle, Briefcase, ShieldCheck } from 'lucide-react'
import { apiResetPassword } from '../lib/api'

type ResetState = 'form' | 'success' | 'error'

function StrengthBar({ password }: { password: string }) {
  const len = password.length
  const score = len === 0 ? 0 : len < 6 ? 1 : len < 10 ? 2 : len < 14 ? 3 : 4
  const labels = ['', 'Weak', 'Fair', 'Good', 'Strong']
  const colors = ['', 'bg-red-400', 'bg-amber-400', 'bg-blue-400', 'bg-emerald-400']
  return (
    <div className="space-y-1.5 mt-2">
      <div className="flex gap-1">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full transition-all duration-300 ${i <= score ? colors[score] : 'bg-[#e8eef5]'}`}
          />
        ))}
      </div>
      {score > 0 && (
        <p className={`text-[11px] font-semibold ${score <= 1 ? 'text-red-500' : score === 2 ? 'text-amber-500' : score === 3 ? 'text-blue-500' : 'text-emerald-500'}`}>
          {labels[score]}
        </p>
      )}
    </div>
  )
}

export default function ResetPassword() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const token = searchParams.get('token')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [state, setState] = useState<ResetState>(token ? 'form' : 'error')

  const handleSubmit = async (e: { preventDefault(): void }) => {
    e.preventDefault()
    setError('')

    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }
    if (!token) { setState('error'); return }

    setIsLoading(true)
    try {
      await apiResetPassword(token, password)
      setState('success')
    } catch (err: any) {
      setError(err?.message || 'Failed to reset password. The link may have expired.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen">
      {/* Left panel */}
      <div className="hidden lg:flex lg:w-[52%] flex-col justify-between p-14 relative overflow-hidden bg-[#0d1829]">
        <div className="absolute top-[-120px] right-[-80px] w-[400px] h-[400px] rounded-full bg-[#2f6df6]/20 blur-[80px] pointer-events-none" />
        <div className="absolute bottom-[-80px] left-[-60px] w-[300px] h-[300px] rounded-full bg-[#2f6df6]/10 blur-[60px] pointer-events-none" />
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
          <h2 className="text-[38px] font-bold leading-[1.15] text-white mb-4">
            Choose a strong<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#2f6df6] to-[#6fa0ff]">
              new password.
            </span>
          </h2>
          <p className="text-[#7a8fa8] text-base leading-relaxed max-w-xs">
            Pick something unique that you don't use on other sites to keep your account secure.
          </p>
          <div className="mt-8 space-y-3">
            {[
              'At least 8 characters',
              'Mix letters, numbers & symbols',
              'Don\'t reuse old passwords',
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
        <div className="lg:hidden flex items-center px-4 pt-6 pb-2">
          <Link to="/" className="text-xl font-bold tracking-tight text-[#101a2b]">
            Job<span className="text-[#2f6df6]">Wahala</span>
          </Link>
        </div>

        <div className="flex flex-1 flex-col justify-center px-4 py-6 sm:px-10 sm:py-12 overflow-y-auto">
          <div className="w-full max-w-[400px] mx-auto">
            <div className="bg-white rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.06)] border border-[#e8eef5] p-5 sm:p-8">

              {state === 'form' && (
                <>
                  <div className="mb-7">
                    <div className="h-11 w-11 rounded-xl bg-[#edf4ff] flex items-center justify-center mb-4">
                      <ShieldCheck className="h-5 w-5 text-[#2f6df6]" />
                    </div>
                    <h1 className="text-[22px] font-bold text-[#111c2d] mb-1">Set new password</h1>
                    <p className="text-sm text-[#6b7a8d]">Choose a strong password for your account.</p>
                  </div>

                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                      <label className="block text-[13px] font-semibold text-[#374151] mb-1.5">New password</label>
                      <div className="relative">
                        <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#9caab8]" />
                        <input
                          type={showPassword ? 'text' : 'password'}
                          placeholder="Minimum 8 characters"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          className="w-full h-[44px] pl-10 pr-10 rounded-xl border border-[#dde3ec] bg-[#f7f9fc] text-sm text-[#111c2d] placeholder:text-[#9caab8] outline-none transition-all focus:bg-white focus:border-[#2f6df6] focus:ring-3 focus:ring-[#2f6df6]/10"
                          required
                          minLength={8}
                          autoFocus
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
                      {password && <StrengthBar password={password} />}
                    </div>

                    <div>
                      <label className="block text-[13px] font-semibold text-[#374151] mb-1.5">Confirm password</label>
                      <div className="relative">
                        <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#9caab8]" />
                        <input
                          type={showConfirm ? 'text' : 'password'}
                          placeholder="Re-enter your password"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          className={`w-full h-[44px] pl-10 pr-10 rounded-xl border bg-[#f7f9fc] text-sm text-[#111c2d] placeholder:text-[#9caab8] outline-none transition-all focus:bg-white focus:ring-3 ${
                            confirmPassword && confirmPassword !== password
                              ? 'border-red-300 focus:border-red-400 focus:ring-red-400/10'
                              : 'border-[#dde3ec] focus:border-[#2f6df6] focus:ring-[#2f6df6]/10'
                          }`}
                          required
                          minLength={8}
                          autoComplete="new-password"
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirm(!showConfirm)}
                          className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#9caab8] hover:text-[#6b7a8d] transition-colors"
                          tabIndex={-1}
                        >
                          {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                      {confirmPassword && confirmPassword !== password && (
                        <p className="text-[11px] text-red-500 font-medium mt-1.5">Passwords don't match</p>
                      )}
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
                          Resetting…
                        </span>
                      ) : (
                        <>Reset password <ArrowRight className="h-4 w-4" /></>
                      )}
                    </button>
                  </form>
                </>
              )}

              {state === 'success' && (
                <div className="text-center py-2">
                  <div className="h-14 w-14 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center mx-auto mb-5">
                    <CheckCircle className="h-7 w-7 text-emerald-500" />
                  </div>
                  <h1 className="text-[22px] font-bold text-[#111c2d] mb-2">Password updated!</h1>
                  <p className="text-sm text-[#6b7a8d] leading-relaxed mb-6">
                    Your password has been reset successfully. You can now sign in with your new password.
                  </p>
                  <button
                    onClick={() => navigate('/login')}
                    className="w-full h-[44px] rounded-xl bg-gradient-to-r from-[#2f6df6] to-[#4d85ff] text-white text-sm font-semibold flex items-center justify-center gap-2 shadow-md shadow-[#2f6df6]/20 hover:brightness-105 transition-all"
                  >
                    Go to sign in <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              )}

              {state === 'error' && (
                <div className="text-center py-2">
                  <div className="h-14 w-14 rounded-2xl bg-red-50 border border-red-100 flex items-center justify-center mx-auto mb-5">
                    <XCircle className="h-7 w-7 text-red-400" />
                  </div>
                  <h1 className="text-[22px] font-bold text-[#111c2d] mb-2">Invalid or expired link</h1>
                  <p className="text-sm text-[#6b7a8d] leading-relaxed mb-6">
                    This password reset link is no longer valid. Please request a new one.
                  </p>
                  <div className="space-y-3">
                    <Link
                      to="/forgot-password"
                      className="w-full h-[44px] rounded-xl bg-gradient-to-r from-[#2f6df6] to-[#4d85ff] text-white text-sm font-semibold flex items-center justify-center gap-2 shadow-md shadow-[#2f6df6]/20 hover:brightness-105 transition-all"
                    >
                      Request new link <ArrowRight className="h-4 w-4" />
                    </Link>
                    <Link
                      to="/login"
                      className="w-full h-[44px] rounded-xl border border-[#dde3ec] bg-white text-sm font-semibold text-[#374151] flex items-center justify-center gap-2 hover:bg-[#f7f9fc] hover:border-[#b8c8dc] transition-all"
                    >
                      <ArrowLeft className="h-4 w-4" /> Back to sign in
                    </Link>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
