import { Search, BookOpen, MessageSquare, Shield, CreditCard, User, HelpCircle, ArrowRight } from 'lucide-react'
import { useState, useMemo } from 'react'
import SEO from '../components/SEO'

const supportCategories = [
  {
    id: 'getting-started',
    title: 'Getting Started',
    icon: <BookOpen className="h-6 w-6 text-primary" />,
    description: 'Learn the basics of JobWahala.',
    questions: [
      { q: "How do I create a profile?", a: "To create a profile, click on 'Sign Up' and select your role (Freelancer or Employer). Follow the onboarding steps to complete your profile." },
      { q: "Is JobWahala free?", a: "Creating an account and browsing jobs is free. We charge a small service fee on successful transactions." }
    ]
  },
  {
    id: 'payments',
    title: 'Payments & Fees',
    icon: <CreditCard className="h-6 w-6 text-success" />,
    description: 'Everything about Escrow and Paystack.',
    questions: [
      { q: "What is Escrow?", a: "Escrow is a secure way to pay for services. The client pays JobWahala, we hold the funds, and release them to the freelancer once the work is approved." },
      { q: "How do I link my Mobile Money account?", a: "Go to your 'Settings' -> 'Payout Accounts' to link your MTN, Telecel, or AT account." }
    ]
  },
  {
    id: 'disputes',
    title: 'Disputes & Safety',
    icon: <Shield className="h-6 w-6 text-error" />,
    description: 'How we handle resolutions.',
    questions: [
      { q: "How do I open a dispute?", a: "If you have an issue with a milestone, click 'Contest' on the Agreement page to open a dispute for admin review." },
      { q: "What is the 24-hour hold?", a: "To protect both parties, payouts have a 24-hour security hold before they are automatically released." }
    ]
  }
]

export default function Support() {
  const [searchQuery, setSearchQuery] = useState('')

  const filteredCategories = useMemo(() => {
    if (!searchQuery) return supportCategories
    return supportCategories.map(cat => ({
      ...cat,
      questions: cat.questions.filter(q => 
        q.q.toLowerCase().includes(searchQuery.toLowerCase()) || 
        q.a.toLowerCase().includes(searchQuery.toLowerCase())
      )
    })).filter(cat => cat.questions.length > 0)
  }, [searchQuery])

  return (
    <div className="fade-in pt-24 pb-20 md:pt-28 md:pb-24 xl:pt-32 xl:pb-32">
      <SEO 
        title="Support Hub — JobWahala Help Center" 
        description="Find answers to common questions about hiring, payments, and disputes on JobWahala."
      />

      <div className="container">
        {/* Hero Section */}
        <div className="mb-16 text-center max-w-3xl mx-auto">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/10 bg-white/80 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-primary shadow-premium-sm backdrop-blur-xl">
            <HelpCircle className="h-4 w-4" /> Support Center
          </div>
          <h1 className="mb-8 text-5xl font-black tracking-tighter leading-[0.92] text-text-main sm:text-6xl">
            How can we <span className="text-primary italic">help you?</span>
          </h1>
          
          <div className="relative group max-w-xl mx-auto">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 h-5 w-5 text-text-light group-focus-within:text-primary transition-colors" />
            <input 
              type="text" 
              placeholder="Search for articles, guides, or questions..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-surface-alt border-none rounded-[2rem] py-5 pl-14 pr-6 text-base font-bold shadow-premium-lg ring-1 ring-surface-border focus:ring-2 focus:ring-primary/20 transition-all" 
            />
          </div>
        </div>

        {/* Categories Grid */}
        {!searchQuery && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-20">
            {supportCategories.map((cat) => (
              <div key={cat.id} className="dashboard-panel group hover:border-primary/30 transition-all cursor-pointer">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-surface-alt group-hover:bg-primary/5 transition-colors">
                  {cat.icon}
                </div>
                <h3 className="text-xl font-black text-text-main mb-2">{cat.title}</h3>
                <p className="text-sm text-text-muted font-medium mb-6">{cat.description}</p>
                <div className="flex items-center text-[10px] font-black uppercase tracking-widest text-primary group-hover:translate-x-1 transition-transform">
                  View Articles <ArrowRight className="ml-2 h-3.5 w-3.5" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* FAQ Sections */}
        <div className="space-y-16">
          {filteredCategories.map((cat) => (
            <section key={cat.id}>
              <div className="flex items-center gap-4 mb-8">
                <div className="h-8 w-[2px] bg-primary rounded-full"></div>
                <h2 className="text-2xl font-black text-text-main tracking-tight">{cat.title}</h2>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {cat.questions.map((item, idx) => (
                  <div key={idx} className="rounded-3xl border border-surface-border bg-white p-8 hover:shadow-premium-xl transition-all">
                    <h4 className="text-lg font-black text-text-main mb-4 leading-tight">{item.q}</h4>
                    <p className="text-base text-text-muted font-medium leading-relaxed">{item.a}</p>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>

        {/* Direct Contact */}
        <div className="mt-32 rounded-[3.5rem] bg-text-main p-12 text-center text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary/20 blur-[100px] rounded-full"></div>
          <div className="relative z-10">
            <h2 className="mb-6 text-4xl font-black tracking-tighter">Still need <span className="text-primary italic">human help?</span></h2>
            <p className="mb-10 text-xl font-medium text-white/70 max-w-2xl mx-auto">Our Accra-based support team is available 24/7 to assist you with payments, account issues, and dispute resolution.</p>
            <button className="rounded-full bg-primary px-10 py-5 text-sm font-black uppercase tracking-widest text-white shadow-premium-lg hover:scale-105 active:scale-95 transition-all">
              Live Support Chat
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
