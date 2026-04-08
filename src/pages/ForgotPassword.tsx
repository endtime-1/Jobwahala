import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Mail, ArrowLeft, ArrowRight, CheckCircle, Briefcase } from 'lucide-react'
import { apiForgotPassword } from '../lib/api'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [sent, setSent] = useState(false)

  const handleSubmit = async (e: { preventDefault(): void }) => {
    e.preventDefault()
    if (!email || isLoading) return
    setIsLoading(true)
    try {
      await apiForgotPassword(email)
    } catch {
      // Always show success to prevent email enumeration
    } finally {
      setSent(true)
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
            Forgot your<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#2f6df6] to-[#6fa0ff]">
              password?
            </span>
          </h2>
          <p className="text-[#7a8fa8] text-base leading-relaxed max-w-xs">
            No worries — it happens to everyone. Enter your email and we'll send you a link to get back in.
          </p>
          <div className="mt-8 space-y-3">
            {[
              'Link expires after 1 hour',
              'Check your spam folder if needed',
              'Your account stays secure',
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
              {!sent ? (
                <>
                  <div className="mb-7">
                    <div className="h-11 w-11 rounded-xl bg-[#edf4ff] flex items-center justify-center mb-4">
                      <Mail className="h-5 w-5 text-[#2f6df6]" />
                    </div>
                    <h1 className="text-[22px] font-bold text-[#111c2d] mb-1">Reset your password</h1>
                    <p className="text-sm text-[#6b7a8d]">
                      Enter your email and we'll send you a reset link.
                    </p>
                  </div>

                  <form onSubmit={handleSubmit} className="space-y-4">
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
                          autoFocus
                          autoComplete="email"
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={isLoading}
                      className="w-full h-[44px] rounded-xl bg-gradient-to-r from-[#2f6df6] to-[#4d85ff] text-white text-sm font-semibold flex items-center justify-center gap-2 shadow-md shadow-[#2f6df6]/20 hover:shadow-lg hover:shadow-[#2f6df6]/30 hover:brightness-105 transition-all active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {isLoading ? (
                        <span className="flex items-center gap-2">
                          <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                          Sending…
                        </span>
                      ) : (
                        <>Send reset link <ArrowRight className="h-4 w-4" /></>
                      )}
                    </button>
                  </form>

                  <div className="mt-5 text-center">
                    <Link to="/login" className="inline-flex items-center gap-1.5 text-[13px] text-[#6b7a8d] hover:text-[#111c2d] transition-colors font-medium">
                      <ArrowLeft className="h-3.5 w-3.5" /> Back to sign in
                    </Link>
                  </div>
                </>
              ) : (
                <div className="text-center py-2">
                  <div className="h-14 w-14 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center mx-auto mb-5">
                    <CheckCircle className="h-7 w-7 text-emerald-500" />
                  </div>
                  <h1 className="text-[22px] font-bold text-[#111c2d] mb-2">Check your inbox</h1>
                  <p className="text-sm text-[#6b7a8d] leading-relaxed mb-1">
                    We sent a reset link to
                  </p>
                  <p className="text-sm font-semibold text-[#111c2d] mb-6">{email}</p>

                  <div className="rounded-xl bg-[#f7f9fc] border border-[#e8eef5] px-4 py-3 mb-6">
                    <p className="text-[12px] text-[#9caab8]">The link expires in <span className="font-semibold text-[#6b7a8d]">1 hour</span>. Check your spam folder if you don't see it.</p>
                  </div>

                  <div className="space-y-3">
                    <button
                      onClick={() => { setSent(false); setEmail('') }}
                      className="w-full h-[44px] rounded-xl border border-[#dde3ec] bg-white text-sm font-semibold text-[#374151] hover:bg-[#f7f9fc] hover:border-[#b8c8dc] transition-all"
                    >
                      Try a different email
                    </button>
                    <Link
                      to="/login"
                      className="w-full h-[44px] rounded-xl bg-gradient-to-r from-[#2f6df6] to-[#4d85ff] text-white text-sm font-semibold flex items-center justify-center gap-2 shadow-md shadow-[#2f6df6]/20 hover:brightness-105 transition-all"
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
