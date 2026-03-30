import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Rocket, Mail, Lock, ChevronRight, Github, Chrome, Zap } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { isApiUnavailableMessage } from '../lib/apiStatus'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
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
    <div className="auth-dark relative flex min-h-screen items-center justify-center overflow-hidden bg-text-main px-4 py-[calc(env(safe-area-inset-top)+1rem)] sm:px-6 lg:py-0">
      {/* Immersive Animated Background */}
      <div className="absolute inset-0 bg-primary/10 mix-blend-overlay z-0"></div>
      
      {/* Giant Glowing Orbs */}
      <div className="absolute top-[10%] left-[20%] w-[800px] h-[800px] bg-primary/20 rounded-full blur-[120px] mix-blend-screen animate-pulse z-0 pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[10%] w-[600px] h-[600px] bg-secondary/30 rounded-full blur-[100px] mix-blend-screen z-0 pointer-events-none" style={{ animation: 'pulse 8s cubic-bezier(0.4, 0, 0.6, 1) infinite' }}></div>
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-transparent via-text-main/80 to-text-main z-0 pointer-events-none"></div>

      {/* Floating Glassmorphic Container */}
      <div className="relative z-10 flex w-full max-w-6xl flex-col items-center gap-10 p-2 sm:p-4 lg:flex-row lg:gap-14 lg:p-10">
        {/* Left Side: Text/Brand */}
        <div className="flex-1 animate-in slide-in-from-left duration-1000 w-full text-left">
          <Link to="/" className="mb-8 inline-flex items-center gap-3 group">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/30 bg-primary/20 shadow-[0_0_30px_rgba(0,0,0,0.3)] shadow-primary/20 transition-all group-hover:-rotate-12 group-hover:bg-primary">
              <Rocket className="h-6 w-6 text-white" />
            </div>
            <span className="text-3xl font-black tracking-tighter text-white sm:text-4xl">Job<span className="text-primary drop-shadow-[0_0_15px_rgba(var(--color-primary),0.5)]">Wahala</span></span>
          </Link>
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-white/80 backdrop-blur-md shadow-inner">
            <Zap className="h-3.5 w-3.5 text-primary" /> The Elite Ecosystem
          </div>
          <h1 className="mb-5 text-4xl font-black tracking-tighter leading-[0.92] text-white sm:text-6xl lg:text-[80px]">
            Initialize <br/><span className="text-transparent bg-clip-text bg-gradient-to-r from-primary via-secondary to-primary animate-gradient bg-[length:200%_auto]">Session.</span>
          </h1>
          <p className="max-w-md text-base font-medium leading-relaxed text-white/60 sm:text-lg">
            Verify your identity to access your professional dashboard, elite opportunities, and active workspace protocols.
          </p>
        </div>

        {/* Right Side: Auth Form in Ultimate Glass Card */}
        <div className="w-full max-w-md shrink-0 animate-in slide-in-from-right duration-1000 delay-150">
          <div className="relative overflow-hidden rounded-[2rem] border border-white/20 bg-white/10 p-6 shadow-[0_0_50px_rgba(0,0,0,0.3)] shadow-primary/10 backdrop-blur-3xl sm:p-8 lg:rounded-[2.5rem] lg:p-10">
            <div className="absolute top-0 right-0 w-64 h-64 bg-primary/20 rounded-full blur-[80px] -mr-32 -mt-32 mix-blend-screen transition-opacity group-hover/card:opacity-100 opacity-50 z-0"></div>
            
            <form onSubmit={handleLogin} className="relative z-10 shrink-0 space-y-6 sm:space-y-8">
              <div className="space-y-5 sm:space-y-6">
                {/* Inputs with Ultra Glass aesthetic */}
                <div className="relative group/input">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-white/60 mb-2 block group-focus-within/input:text-white transition-colors">Access Protocol</label>
                  <div className="relative">
                    <Mail className="absolute left-5 top-1/2 -translate-y-1/2 h-5 w-5 text-white/40 group-focus-within/input:text-primary transition-colors z-10" />
                    <input 
                      type="email" 
                      placeholder="name@enterprise.com" 
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="h-16 w-full rounded-2xl border border-white/10 bg-white/5 pl-14 pr-6 font-bold text-white placeholder:text-white/30 outline-none transition-all focus:border-primary/50 focus:bg-white/10 focus:ring-4 focus:ring-primary/20"
                      required 
                    />
                  </div>
                </div>

                <div className="relative group/input">
                  <div className="flex justify-between items-end mb-2">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-white/60 group-focus-within/input:text-white transition-colors">Security Key</label>
                    <Link to="/forgot-password" className="text-[10px] font-black text-primary hover:text-white uppercase tracking-widest transition-colors shadow-sm drop-shadow-md">Forgot Key?</Link>
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-5 top-1/2 -translate-y-1/2 h-5 w-5 text-white/40 group-focus-within/input:text-primary transition-colors z-10" />
                    <input 
                      type="password" 
                      placeholder="Password" 
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="h-16 w-full rounded-2xl border border-white/10 bg-white/5 pl-14 pr-6 font-bold text-white placeholder:text-white/30 outline-none transition-all focus:border-primary/50 focus:bg-white/10 focus:ring-4 focus:ring-primary/20"
                      required 
                    />
                  </div>
                </div>
              </div>

              {error && (
                <p className="text-red-400 text-sm font-semibold text-center bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">{error}</p>
              )}

              <button type="submit" disabled={isLoading} className="group/btn flex h-16 w-full items-center justify-center gap-3 rounded-2xl bg-primary font-black uppercase tracking-widest text-white shadow-[0_0_30px_rgba(var(--color-primary),0.3)] shadow-primary/40 transition-all hover:scale-[1.02] hover:bg-white hover:text-text-main hover:shadow-primary/60 disabled:cursor-not-allowed disabled:opacity-60">
                {isLoading ? 'Authenticating...' : <> Unlock Workspace <ChevronRight className="h-6 w-6 group-hover/btn:translate-x-1 transition-transform" /></>}
              </button>

              <div className="relative py-4">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/10"></div></div>
                <div className="relative flex justify-center text-[9px] font-black uppercase tracking-[0.3em]"><span className="bg-text-main px-4 text-white/40 rounded-full border border-white/5 py-1">Third-Party Auth</span></div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <button type="button" className="h-14 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center gap-3 text-[10px] font-black uppercase tracking-widest text-white hover:bg-white/10 hover:border-white/30 transition-all backdrop-blur-md">
                  <Chrome className="h-4 w-4" /> Google
                </button>
                <button type="button" className="h-14 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center gap-3 text-[10px] font-black uppercase tracking-widest text-white hover:bg-white/10 hover:border-white/30 transition-all backdrop-blur-md">
                  <Github className="h-4 w-4" /> GitHub
                </button>
              </div>
            </form>
          </div>
          
          <p className="mt-6 text-center text-sm font-medium text-white/60 sm:mt-8">
            Unregistered identity? <Link to="/signup" className="text-primary font-black uppercase tracking-widest text-[11px] ml-2 hover:text-white transition-colors">Create Account</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
