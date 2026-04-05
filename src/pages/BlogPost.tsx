import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, Clock, User, Calendar, Share2 } from 'lucide-react'
import SEO from '../components/SEO'
import { blogPosts } from '../data/blogData'

export default function BlogPost() {
  const { id } = useParams()
  const post = blogPosts.find(p => p.id === id)

  if (!post) {
    return (
      <div className="pt-32 pb-20 text-center">
        <h1 className="text-2xl font-bold">Post not found</h1>
        <Link to="/blog" className="text-primary hover:underline mt-4 inline-block">Back to Blog</Link>
      </div>
    )
  }

  return (
    <div className="fade-in pt-24 pb-20 md:pt-28 md:pb-24 xl:pt-32 xl:pb-32">
      <SEO 
        title={`${post.title} — JobWahala Resource Center`}
        description={post.excerpt}
      />

      <div className="container max-w-4xl">
        <Link to="/blog" className="mb-12 inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-text-light hover:text-primary transition-colors">
          <ArrowLeft className="h-4 w-4" /> Back to Resources
        </Link>

        <header className="mb-12">
          <div className="mb-6 flex flex-wrap items-center gap-4 text-[10px] font-black uppercase tracking-widest text-primary">
            <span>{post.category}</span>
            <span className="h-1 w-1 rounded-full bg-surface-border"></span>
            <span className="text-text-light">{post.readTime}</span>
          </div>
          <h1 className="mb-8 text-4xl font-black tracking-tighter leading-[1.1] text-text-main md:text-5xl lg:text-6xl">
            {post.title}
          </h1>
          
          <div className="flex items-center justify-between border-y border-surface-border py-8">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-full bg-surface-alt flex items-center justify-center font-black text-primary border border-surface-border">
                {post.author.charAt(0)}
              </div>
              <div>
                <p className="text-sm font-black text-text-main">{post.author}</p>
                <div className="flex items-center gap-2 text-[10px] font-bold text-text-light uppercase tracking-widest">
                  <Calendar className="h-3 w-3" /> {post.date}
                </div>
              </div>
            </div>
            <button className="h-10 w-10 rounded-full border border-surface-border flex items-center justify-center text-text-light hover:text-primary hover:border-primary transition-all">
              <Share2 className="h-4 w-4" />
            </button>
          </div>
        </header>

        <div className="mb-16 rounded-[2.5rem] overflow-hidden shadow-premium-2xl aspect-video md:aspect-[21/9]">
          <img src={post.image} alt={post.title} className="w-full h-full object-cover" />
        </div>

        <article className="prose prose-lg max-w-none prose-headings:font-black prose-headings:tracking-tighter prose-headings:text-text-main prose-p:text-text-muted prose-p:leading-relaxed prose-strong:text-text-main">
          <div dangerouslySetInnerHTML={{ __html: post.content.replace(/\n/g, '<br/>') }} />
        </article>

        {/* Post Footer */}
        <div className="mt-20 border-t border-surface-border pt-12">
           <div className="rounded-[2.5rem] bg-surface-alt p-10 text-center">
              <h3 className="text-2xl font-black text-text-main mb-4 tracking-tight">Was this helpful?</h3>
              <p className="text-text-muted mb-8 font-medium">Join our newsletter for more insights on the Ghanaian job market.</p>
              <div className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
                <input type="email" placeholder="Enter your email" className="flex-1 rounded-2xl border-none bg-white px-6 py-4 text-sm font-bold shadow-premium-sm" />
                <button className="rounded-2xl bg-text-main px-8 py-4 text-[10px] font-black uppercase tracking-widest text-white hover:bg-neutral-800 transition-colors">Subscribe</button>
              </div>
           </div>
        </div>
      </div>
    </div>
  )
}
