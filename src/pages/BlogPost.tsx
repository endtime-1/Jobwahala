import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Calendar, Clock, MessageCircle } from 'lucide-react'
import SEO from '../components/SEO'
import { heroBackground } from '../components/PageHero'
import { blogPosts } from '../data/blogData'

// Articles are written with "## Heading" lines and plain paragraphs.
const toBlocks = (content: string) =>
  content
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) =>
      line.startsWith('## ') ? { kind: 'heading' as const, text: line.slice(3) } : { kind: 'paragraph' as const, text: line },
    )

export default function BlogPost() {
  const { id } = useParams()
  const post = blogPosts.find((p) => p.id === id)

  if (!post) {
    return (
      <div className="container pb-24 pt-36 text-center">
        <h1 className="text-3xl font-black text-text-main">We can&apos;t find that article</h1>
        <Link to="/blog" className="btn btn-primary mt-6 inline-flex px-6">
          Back to all articles
        </Link>
      </div>
    )
  }

  const shareText = `${post.title} - JobWahala: ${window.location.href}`
  const otherPosts = blogPosts.filter((p) => p.id !== post.id).slice(0, 2)

  return (
    <div className="pb-20 pt-32 xl:pt-36">
      <SEO title={`${post.title} — JobWahala Resource Center`} description={post.excerpt} />

      <div className="container max-w-4xl">
        <Link to="/blog" className="mb-5 inline-flex items-center gap-2 text-sm font-bold text-text-muted transition-colors hover:text-secondary">
          <ArrowLeft className="h-4 w-4" /> All articles
        </Link>

        <header className="relative overflow-hidden rounded-[2rem] px-5 py-9 text-white sm:px-9 sm:py-12" style={{ background: heroBackground }}>
          <div className="heritage-strip absolute inset-x-0 top-0" aria-hidden />
          <p className="page-eyebrow">{post.category}</p>
          <h1 className="mt-3 text-3xl font-black leading-[1.1] tracking-tight sm:text-5xl">{post.title}</h1>
          <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm font-semibold text-white/75">
            <span className="inline-flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gold text-base font-extrabold text-primary">
                {post.author.charAt(0)}
              </span>
              {post.author}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Calendar className="h-4 w-4 text-gold" /> {post.date}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Clock className="h-4 w-4 text-gold" /> {post.readTime}
            </span>
            <a
              href={`https://wa.me/?text=${encodeURIComponent(shareText)}`}
              target="_blank"
              rel="noreferrer"
              className="ml-auto inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-2 font-bold text-white hover:bg-white/25"
            >
              <MessageCircle className="h-4 w-4" /> Share
            </a>
          </div>
        </header>

        <article className="mx-auto mt-10 max-w-3xl">
          {toBlocks(post.content).map((block, index) =>
            block.kind === 'heading' ? (
              <h2 key={index} className="mb-3 mt-10 text-2xl font-black tracking-tight text-text-main sm:text-3xl">
                {block.text}
              </h2>
            ) : (
              <p key={index} className="mb-5 text-lg font-medium leading-8 text-text-muted">
                {block.text}
              </p>
            ),
          )}
        </article>

        <div className="mt-14 overflow-hidden rounded-[2rem] px-6 py-10 text-center text-white sm:px-10" style={{ background: heroBackground }}>
          <h2 className="text-3xl font-black tracking-tight">Ready to put this into practice?</h2>
          <p className="mx-auto mt-2 max-w-lg font-medium text-white/75">
            Create a free account to find jobs or hire people across Africa. Payment stays protected until the work is done.
          </p>
          <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
            <Link to="/onboarding?role=seeker" className="btn btn-gold btn-lg justify-center px-8">
              Find work <ArrowRight className="h-5 w-5" />
            </Link>
            <Link to="/onboarding?role=employer" className="btn btn-lg justify-center border-white/25 bg-white/10 px-8 text-white hover:bg-white/20">
              Hire people
            </Link>
          </div>
        </div>

        {otherPosts.length > 0 ? (
          <section className="mt-14">
            <h2 className="text-2xl font-black tracking-tight text-text-main">Keep reading</h2>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              {otherPosts.map((other) => (
                <Link
                  key={other.id}
                  to={`/blog/${other.id}`}
                  className="group rounded-2xl border border-surface-border bg-white p-5 transition-all hover:-translate-y-0.5 hover:border-secondary/40 hover:shadow-premium-md"
                >
                  <p className="text-sm font-bold text-secondary">{other.category}</p>
                  <p className="mt-1 text-lg font-extrabold leading-snug text-text-main group-hover:text-secondary">{other.title}</p>
                  <p className="mt-2 text-sm font-medium text-text-muted">{other.readTime}</p>
                </Link>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </div>
  )
}
