import { BookOpen, ArrowRight, Clock, User, Tag, Search } from 'lucide-react'
import { Link } from 'react-router-dom'
import SEO from '../components/SEO'

const blogPosts = [
  {
    id: 'hiring-in-ghana',
    title: "How to Hire Elite Tech Talent in Ghana: 2026 Guide",
    excerpt: "Accra's tech scene is exploding. Learn how to navigate the local landscape, salary benchmarks, and cultural nuances of hiring in the Gateway to Africa.",
    author: "JobWahala Editorial",
    date: "April 2, 2026",
    readTime: "8 min read",
    category: "Hiring Guide",
    image: "https://images.unsplash.com/photo-1589182373726-e4f658ab50f0?auto=format&fit=crop&q=80&w=800",
  },
  {
    id: 'freelance-success-ghana',
    title: "Success Spotlight: From Kumasi to Global Contracts",
    excerpt: "Meet the freelancers defying boundaries. A deep dive into how Ghanaian professionals are leveraging JobWahala to secure high-paying international gigs.",
    author: "Community Team",
    date: "March 28, 2026",
    readTime: "5 min read",
    category: "Success Stories",
    image: "https://images.unsplash.com/photo-1531482615713-2afd69097998?auto=format&fit=crop&q=80&w=800",
  },
  {
    id: 'remote-work-readiness',
    title: "5 Skills Every Ghanaian Freelancer Needs for 2026",
    excerpt: "Technical skill is only half the battle. We explore the soft skills and infrastructure setups needed to thrive in the global remote work economy.",
    author: "Career Coach",
    date: "March 20, 2026",
    readTime: "6 min read",
    category: "Career Tips",
    image: "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&q=80&w=800",
  },
]

export default function Blog() {
  return (
    <div className="fade-in pt-24 pb-20 md:pt-28 md:pb-24 xl:pt-32 xl:pb-32">
      <SEO 
        title="Resource Center — Insights on Hiring & Working in Ghana"
        description="Stay ahead with the latest trends in the Ghanaian job market. Guides for employers hiring in Accra and tips for freelancers going global."
      />
      
      <div className="container">
        {/* Header */}
        <section className="mb-16 md:mb-24 text-center max-w-3xl mx-auto">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/10 bg-white/80 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-primary shadow-premium-sm backdrop-blur-xl">
            <BookOpen className="h-4 w-4" /> The JobWahala Gazette
          </div>
          <h1 className="mb-8 text-5xl font-black tracking-tighter leading-[0.92] text-text-main sm:text-6xl md:text-7xl">
            Insights for the <br/>
            <span className="text-primary italic">Ghanaian Frontier.</span>
          </h1>
          <p className="text-lg font-medium leading-relaxed text-text-muted md:text-xl">
            Your guide to navigating the future of work in Ghana. Whether you're building a team in Accra or scaling your freelance career globally.
          </p>
        </section>

        {/* Search & Filter (Placeholder UI) */}
        <div className="mb-12 flex flex-col md:flex-row items-center justify-between gap-6 border-b border-surface-border pb-8">
          <div className="flex flex-wrap gap-3">
            {['All', 'Hiring Guide', 'Success Stories', 'Career Tips', 'Market Trends'].map((cat) => (
              <button key={cat} className={`px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${cat === 'All' ? 'bg-primary text-white' : 'bg-surface-alt text-text-muted hover:bg-surface-border'}`}>
                {cat}
              </button>
            ))}
          </div>
          <div className="relative group w-full md:w-64">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-text-light group-focus-within:text-primary transition-colors" />
            <input type="text" placeholder="Search articles..." className="w-full bg-surface-alt border-none rounded-2xl py-3 pl-12 pr-4 text-sm font-bold focus:ring-2 focus:ring-primary/20" />
          </div>
        </div>

        {/* Featured Post (Template) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 mb-20 items-center">
          <div className="rounded-[3rem] overflow-hidden shadow-premium-2xl aspect-video lg:aspect-square relative group">
            <img src={blogPosts[0].image} alt={blogPosts[0].title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent"></div>
            <div className="absolute bottom-10 left-10 right-10">
               <span className="px-3 py-1 bg-primary text-white rounded-lg text-[10px] font-black uppercase tracking-widest mb-4 inline-block">Featured</span>
               <h2 className="text-3xl font-black text-white tracking-tighter leading-tight">{blogPosts[0].title}</h2>
            </div>
          </div>
          <div className="space-y-8">
            <p className="text-primary font-black text-xs uppercase tracking-[0.2em]">{blogPosts[0].category}</p>
            <h2 className="text-4xl font-black text-text-main tracking-tighter leading-tight">{blogPosts[0].title}</h2>
            <p className="text-xl text-text-muted font-medium leading-relaxed">{blogPosts[0].excerpt}</p>
            <div className="flex items-center gap-6 pt-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 bg-surface-alt rounded-full flex items-center justify-center font-black text-primary">JW</div>
                <div>
                  <p className="text-xs font-black text-text-main">{blogPosts[0].author}</p>
                  <p className="text-[10px] text-text-light font-bold uppercase tracking-widest">{blogPosts[0].date}</p>
                </div>
              </div>
              <div className="h-10 w-[1px] bg-surface-border"></div>
              <p className="text-[10px] text-text-light font-black uppercase tracking-widest">{blogPosts[0].readTime}</p>
            </div>
            <button className="btn btn-primary btn-lg px-8 sm:px-10 mt-4">
               Read Full Guide <ArrowRight className="h-6 w-6" />
            </button>
          </div>
        </div>

        {/* Grid Posts */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
          {blogPosts.slice(1).map((post) => (
            <div key={post.id} className="card group hover:scale-[1.02] shadow-premium-lg border-surface-border/50 overflow-hidden">
               <div className="aspect-[16/10] overflow-hidden -mx-7 -mt-7 mb-7 relative">
                 <img src={post.image} alt={post.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                 <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-md px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest text-primary shadow-sm">
                   {post.category}
                 </div>
               </div>
               <h3 className="mb-4 text-2xl font-black tracking-tighter text-text-main group-hover:text-primary transition-colors leading-tight">
                 {post.title}
               </h3>
               <p className="text-text-muted text-base leading-relaxed font-medium mb-8 line-clamp-3">
                 {post.excerpt}
               </p>
               <div className="flex items-center justify-between pt-6 border-t border-surface-border/50">
                 <div className="flex items-center gap-2">
                   <Clock className="h-3.5 w-3.5 text-text-light" />
                   <span className="text-[10px] font-black uppercase tracking-widest text-text-light">{post.readTime}</span>
                 </div>
                 <button className="text-primary font-black uppercase tracking-widest text-[10px] flex items-center gap-2 group/link">
                   Read More <ArrowRight className="h-3.5 w-3.5 group-hover/link:translate-x-1 transition-transform" />
                 </button>
               </div>
            </div>
          ))}
          
          {/* Success Spotlight Placeholder (Trust Pillar) */}
          <div className="card border-dashed border-primary/30 bg-primary/2 border-2 flex flex-col items-center justify-center text-center p-12">
            <div className="h-20 w-20 bg-primary/10 rounded-full flex items-center justify-center mb-6 text-primary">
              <Sparkles className="h-10 w-10" />
            </div>
            <h3 className="text-2xl font-black tracking-tighter text-text-main mb-4">Your Success Story?</h3>
            <p className="text-text-muted font-medium mb-8">Launch your career on JobWahala and become our next featured spotlight for the Ghana community.</p>
            <Link to="/onboarding?role=seeker" className="btn btn-outline border-primary text-primary px-8">
              Join the Launch
            </Link>
          </div>
        </div>
      </div>

       {/* Newsletter Section (Marketing Growth) */}
       <section className="mt-24 md:mt-32">
          <div className="bg-text-main rounded-[4rem] p-12 md:p-20 relative overflow-hidden group shadow-premium-2xl">
             <div className="absolute top-0 right-0 h-full w-1/2 bg-gradient-to-l from-primary/20 to-transparent z-0"></div>
             <div className="relative z-10 flex flex-col lg:flex-row items-center justify-between gap-12">
                <div className="max-w-xl text-left">
                   <h2 className="text-4xl md:text-5xl font-black text-white tracking-tighter leading-tight mb-6">Join the JobWahala Insider.</h2>
                   <p className="text-white/70 text-lg font-medium leading-relaxed">Weekly insights on the Ghanaian job market, exclusive remote opportunities, and career playbooks delivered directly to you.</p>
                </div>
                <div className="w-full lg:w-auto">
                   <div className="flex flex-col sm:flex-row gap-4">
                      <input type="email" placeholder="Enter your email" className="bg-white/10 border border-white/20 text-white rounded-2xl px-8 py-4 w-full sm:w-80 focus:ring-2 focus:ring-primary/20 placeholder:text-white/30 font-bold" />
                      <button className="btn btn-primary px-10 whitespace-nowrap">Subscribe Now</button>
                   </div>
                   <p className="text-[10px] text-white/40 font-bold uppercase tracking-[0.2em] mt-4">Join 2,000+ Ghanaian Professionals</p>
                </div>
             </div>
          </div>
       </section>
    </div>
  )
}

function Sparkles(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
      <path d="M5 3v4" />
      <path d="M19 17v4" />
      <path d="M3 5h4" />
      <path d="M17 19h4" />
    </svg>
  )
}
