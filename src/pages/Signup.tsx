import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Rocket, Mail, Lock, User, ChevronRight, Github, Chrome, Zap } from 'lucide-react'
import { useAuth, type UserRole } from '../context/AuthContext'
import { isApiUnavailableMessage } from '../lib/apiStatus'

export default function Signup() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [role, setRole] = useState<UserRole>('SEEKER')
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
    <div className="auth-dark relative flex min-h-screen items-center justify-center overflow-hidden bg-text-main px-4 py-[calc(env(safe-area-inset-top)+1rem)] sm:px-6 lg:py-0">
      {/* Immersive Animated Background */}
      <div className="absolute inset-0 bg-secondary/5 mix-blend-overlay z-0"></div>
      
      {/* Giant Glowing Orbs for Signup (Different colors) */}
      <div className="absolute top-[-10%] right-[10%] w-[900px] h-[900px] bg-secondary/20 rounded-full blur-[140px] mix-blend-screen animate-pulse z-0 pointer-events-none"></div>
      <div className="absolute bottom-[0%] left-[5%] w-[600px] h-[600px] bg-primary/20 rounded-full blur-[100px] mix-blend-screen z-0 pointer-events-none" style={{ animation: 'pulse 10s cubic-bezier(0.4, 0, 0.6, 1) infinite' }}></div>
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-transparent via-text-main/80 to-text-main z-0 pointer-events-none"></div>

      {/* Floating Glassmorphic Container (Reversed Layout) */}
      <div className="relative z-10 flex w-full max-w-6xl flex-col items-center justify-between gap-10 p-2 sm:p-4 lg:flex-row-reverse lg:gap-14 lg:p-10">
        {/* Right Side: Text/Brand */}
        <div className="flex w-full flex-1 flex-col items-start text-left animate-in slide-in-from-right duration-1000 lg:items-end lg:text-right">
          <Link to="/" className="mb-8 inline-flex w-full items-center justify-start gap-3 group lg:justify-end">
            <span className="order-2 text-3xl font-black tracking-tighter text-white sm:text-4xl lg:order-1">Job<span className="text-secondary drop-shadow-[0_0_15px_rgba(var(--color-secondary),0.5)]">Wahala</span></span>
            <div className="order-1 flex h-12 w-12 items-center justify-center rounded-2xl border border-secondary/30 bg-secondary/20 shadow-[0_0_30px_rgba(0,0,0,0.3)] shadow-secondary/20 transition-all group-hover:rotate-12 group-hover:bg-secondary lg:order-2 lg:group-hover:-rotate-12">
              <Rocket className="h-6 w-6 text-white" />
            </div>
          </Link>
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-white/80 backdrop-blur-md shadow-inner">
            <User className="h-3.5 w-3.5 text-secondary" /> Join the Network
          </div>
          <h1 className="mb-5 text-4xl font-black tracking-tighter leading-[0.92] text-white sm:text-6xl lg:text-[80px]">
            Construct <br/><span className="text-transparent bg-clip-text bg-gradient-to-l from-secondary via-primary to-secondary animate-gradient bg-[length:200%_auto]">The Future.</span>
          </h1>
          <p className="max-w-md text-base font-medium leading-relaxed text-white/60 sm:text-lg lg:text-right">
            Establish your identity within Africa's most elite professional network and access unparalleled opportunities globally.
          </p>
          
          {/* Glass Stats */}
          <div className="mt-8 flex flex-wrap gap-4 justify-start lg:mt-12 lg:justify-end">
            <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-5 shadow-xl backdrop-blur-lg group/stat">
              <div className="absolute inset-0 bg-secondary/10 translate-y-full group-hover/stat:translate-y-0 transition-transform duration-500"></div>
              <p className="text-4xl font-black text-white tracking-tighter mb-1 relative inline-block z-10">
                98%<span className="absolute -top-1 -right-4 h-2 w-2 rounded-full bg-secondary animate-pulse"></span>
              </p>
              <p className="text-[9px] font-black text-white/50 uppercase tracking-[0.2em] relative z-10">Placement Rate</p>
            </div>
            <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-5 shadow-xl backdrop-blur-lg group/stat2">
              <div className="absolute inset-0 bg-primary/10 translate-y-full group-hover/stat2:translate-y-0 transition-transform duration-500"></div>
              <p className="text-4xl font-black text-white tracking-tighter mb-1 relative inline-block z-10">
                450+<span className="absolute -top-1 -right-4 h-2 w-2 rounded-full bg-primary animate-ping"></span>
              </p>
              <p className="text-[9px] font-black text-white/50 uppercase tracking-[0.2em] relative z-10">Verified Partners</p>
            </div>
          </div>
        </div>

        {/* Left Side: Auth Form in Ultimate Glass Card */}
        <div className="w-full max-w-md shrink-0 animate-in slide-in-from-left duration-1000 delay-150">
          <div className="group/card relative overflow-hidden rounded-[2rem] border border-white/20 bg-white/10 p-6 shadow-[0_0_50px_rgba(0,0,0,0.3)] shadow-secondary/10 backdrop-blur-3xl sm:p-8 lg:rounded-[2.5rem] lg:p-10">
            <div className="absolute top-0 left-0 w-64 h-64 bg-secondary/20 rounded-full blur-[80px] -ml-32 -mt-32 mix-blend-screen transition-opacity group-hover/card:opacity-100 opacity-50 z-0"></div>
            
            <form onSubmit={handleSignup} className="relative z-10 space-y-6">
              
              <div className="relative group/input">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-white/60 mb-2 block group-focus-within/input:text-white transition-colors">Legal Identity</label>
                <div className="relative">
                  <User className="absolute left-5 top-1/2 -translate-y-1/2 h-5 w-5 text-white/40 group-focus-within/input:text-secondary transition-colors z-10" />
                  <input 
                    type="text" 
                    placeholder="Enter your full name" 
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="h-16 w-full rounded-2xl border border-white/10 bg-white/5 pl-14 pr-6 font-bold text-white placeholder:text-white/30 outline-none transition-all focus:border-secondary/50 focus:bg-white/10 focus:ring-4 focus:ring-secondary/20"
                    required 
                  />
                </div>
              </div>

              <div className="relative group/input">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-white/60 mb-2 block group-focus-within/input:text-white transition-colors">Access Protocol</label>
                <div className="relative">
                  <Mail className="absolute left-5 top-1/2 -translate-y-1/2 h-5 w-5 text-white/40 group-focus-within/input:text-secondary transition-colors z-10" />
                  <input 
                    type="email" 
                    placeholder="name@enterprise.com" 
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-16 w-full rounded-2xl border border-white/10 bg-white/5 pl-14 pr-6 font-bold text-white placeholder:text-white/30 outline-none transition-all focus:border-secondary/50 focus:bg-white/10 focus:ring-4 focus:ring-secondary/20"
                    required 
                  />
                </div>
              </div>

              <div className="relative group/input">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-white/60 mb-2 block group-focus-within/input:text-white transition-colors">Security Key</label>
                <div className="relative">
                  <Lock className="absolute left-5 top-1/2 -translate-y-1/2 h-5 w-5 text-white/40 group-focus-within/input:text-secondary transition-colors z-10" />
                  <input 
                    type="password" 
                    placeholder="Min 12 characters" 
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-16 w-full rounded-2xl border border-white/10 bg-white/5 pl-14 pr-6 font-bold text-white placeholder:text-white/30 outline-none transition-all focus:border-secondary/50 focus:bg-white/10 focus:ring-4 focus:ring-secondary/20"
                    required 
                  />
                </div>
              </div>

              <div className="relative group/input">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-white/60 mb-2 block group-focus-within/input:text-white transition-colors">Account Type</label>
                <div className="relative">
                  <select 
                    value={role}
                    onChange={(e) => setRole(e.target.value as UserRole)}
                    className="h-16 w-full appearance-none rounded-2xl border border-white/10 bg-white/5 px-6 font-bold text-white outline-none transition-all focus:border-secondary/50 focus:bg-white/10 focus:ring-4 focus:ring-secondary/20"
                  >
                    <option value="SEEKER" className="bg-text-main">Job Seeker</option>
                    <option value="EMPLOYER" className="bg-text-main">Employer</option>
                    <option value="FREELANCER" className="bg-text-main">Freelancer</option>
                  </select>
                </div>
              </div>

              <div className="pt-2">
                {error && (
                  <p className="text-red-400 text-sm font-semibold text-center bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 mb-4">{error}</p>
                )}
                <button type="submit" disabled={isLoading} className="group/btn flex h-16 w-full items-center justify-center gap-3 rounded-2xl bg-secondary font-black uppercase tracking-widest text-white shadow-[0_0_30px_rgba(var(--color-secondary),0.3)] shadow-secondary/40 transition-all hover:scale-[1.02] hover:bg-white hover:text-text-main hover:shadow-secondary/60 disabled:cursor-not-allowed disabled:opacity-60">
                  {isLoading ? 'Processing...' : <> Initialize Profile <ChevronRight className="h-6 w-6 group-hover/btn:translate-x-1 transition-transform" /> </>}
                </button>
              </div>

              <div className="relative py-4">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/10"></div></div>
                <div className="relative flex justify-center text-[9px] font-black uppercase tracking-[0.3em]"><span className="bg-text-main px-4 text-white/40 rounded-full border border-white/5 py-1">Standard Protocol</span></div>
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
          
          <p className="mt-6 block text-center text-sm font-medium text-white/60 lg:hidden">
            Already registered? <Link to="/login" className="text-secondary font-black uppercase tracking-widest text-[11px] ml-2 hover:text-white transition-colors">Log In</Link>
          </p>
        </div>
      </div>
          
      <p className="absolute bottom-8 right-12 text-sm font-medium text-white/60 hidden lg:block z-10">
        Already registered? <Link to="/login" className="text-secondary font-black uppercase tracking-widest text-[11px] ml-2 hover:text-white transition-colors drop-shadow-md">Log In</Link>
      </p>
    </div>
  )
}
