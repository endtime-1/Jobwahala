import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Rocket, CheckCircle, XCircle, Loader2, Mail, Zap } from 'lucide-react'
import { apiVerifyEmail, apiResendVerification } from '../lib/api'

type VerifyState = 'loading' | 'success' | 'expired' | 'invalid' | 'error'

export default function VerifyEmail() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')
  const [state, setState] = useState<VerifyState>(token ? 'loading' : 'invalid')
  const [resendEmail, setResendEmail] = useState('')
  const [resendSent, setResendSent] = useState(false)
  const [resendLoading, setResendLoading] = useState(false)

  useEffect(() => {
    if (!token) {
      setState('invalid')
      return
    }

    apiVerifyEmail(token)
      .then(() => setState('success'))
      .catch((err: any) => {
        const msg = err?.message?.toLowerCase() || ''
        if (msg.includes('expired')) setState('expired')
        else if (msg.includes('invalid')) setState('invalid')
        else setState('error')
      })
  }, [token])

  const handleResend = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!resendEmail || resendLoading) return
    setResendLoading(true)
    try {
      await apiResendVerification(resendEmail)
      setResendSent(true)
    } catch {
      setResendSent(true) // Don't reveal email existence
    } finally {
      setResendLoading(false)
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
            {state === 'loading' && (
              <div className="text-center space-y-6">
                <div className="flex justify-center">
                  <Loader2 className="h-16 w-16 text-primary animate-spin" />
                </div>
                <div>
                  <h1 className="text-2xl font-black text-white mb-2">Verifying Email</h1>
                  <p className="text-white/60 font-medium">Please wait while we verify your email address...</p>
                </div>
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
                  <h1 className="text-2xl font-black text-white mb-2">Email Verified!</h1>
                  <p className="text-white/60 font-medium">Your email has been successfully verified. You're all set to access your full workspace.</p>
                </div>
                <Link
                  to="/login"
                  className="group/btn flex h-14 w-full items-center justify-center gap-3 rounded-2xl bg-primary font-black uppercase tracking-widest text-white text-sm shadow-primary/40 transition-all hover:scale-[1.02] hover:bg-white hover:text-text-main"
                >
                  Go to Login
                </Link>
              </div>
            )}

            {(state === 'expired' || state === 'invalid' || state === 'error') && (
              <div className="space-y-6">
                <div className="text-center">
                  <div className="flex justify-center mb-4">
                    <div className="flex h-20 w-20 items-center justify-center rounded-full bg-red-500/20 border border-red-500/30">
                      <XCircle className="h-10 w-10 text-red-400" />
                    </div>
                  </div>
                  <h1 className="text-2xl font-black text-white mb-2">
                    {state === 'expired' ? 'Link Expired' : state === 'invalid' ? 'Invalid Link' : 'Verification Failed'}
                  </h1>
                  <p className="text-white/60 font-medium">
                    {state === 'expired'
                      ? 'This verification link has expired. Request a new one below.'
                      : state === 'invalid'
                        ? 'This verification link is invalid or has already been used.'
                        : 'Something went wrong. Please try again.'}
                  </p>
                </div>

                {!resendSent ? (
                  <form onSubmit={handleResend} className="space-y-4">
                    <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-white/80 backdrop-blur-md shadow-inner w-full justify-center">
                      <Zap className="h-3.5 w-3.5 text-primary" /> Resend Verification
                    </div>
                    <div className="relative group/input">
                      <label className="text-[10px] font-black uppercase tracking-[0.2em] text-white/60 mb-2 block">Email Address</label>
                      <div className="relative">
                        <Mail className="absolute left-5 top-1/2 -translate-y-1/2 h-5 w-5 text-white/40 group-focus-within/input:text-primary transition-colors z-10" />
                        <input
                          type="email"
                          placeholder="name@enterprise.com"
                          value={resendEmail}
                          onChange={(e) => setResendEmail(e.target.value)}
                          className="h-14 w-full rounded-2xl border border-white/10 bg-white/5 pl-14 pr-6 font-bold text-white placeholder:text-white/30 outline-none transition-all focus:border-primary/50 focus:bg-white/10 focus:ring-4 focus:ring-primary/20"
                          required
                        />
                      </div>
                    </div>
                    <button
                      type="submit"
                      disabled={resendLoading}
                      className="flex h-14 w-full items-center justify-center gap-3 rounded-2xl bg-primary font-black uppercase tracking-widest text-white text-sm shadow-primary/40 transition-all hover:scale-[1.02] hover:bg-white hover:text-text-main disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {resendLoading ? 'Sending...' : 'Send New Link'}
                    </button>
                  </form>
                ) : (
                  <div className="text-center space-y-4">
                    <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-3">
                      <p className="text-emerald-400 text-sm font-semibold">If an account exists with that email, a new verification link has been sent.</p>
                    </div>
                  </div>
                )}

                <div className="text-center">
                  <Link to="/login" className="text-primary font-black uppercase tracking-widest text-[11px] hover:text-white transition-colors">
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
