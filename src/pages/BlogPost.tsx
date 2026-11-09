import { useQuery } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import SEO from '../components/SEO'
import { WhatsAppIcon } from '../components/WhatsAppFollowButton'
import { apiGetBlogPost } from '../lib/api'
import { whatsappChannelUrl } from '../lib/whatsapp'

const formatDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '')

const shareLinks = (url: string, title: string) => {
  const u = encodeURIComponent(url)
  const text = encodeURIComponent(`${title} - JobWahala`)
  return [
    ['WhatsApp', `https://wa.me/?text=${text}%20${u}`],
    ['Facebook', `https://www.facebook.com/sharer/sharer.php?u=${u}`],
    ['LinkedIn', `https://www.linkedin.com/sharing/share-offsite/?url=${u}`],
    ['X', `https://twitter.com/intent/tweet?text=${text}&url=${u}`],
  ] as const
}

export default function BlogPost() {
  const { id: slug = '' } = useParams()
  const { data, isLoading, isError } = useQuery({ queryKey: ['blog-post', slug], queryFn: () => apiGetBlogPost(slug), retry: false })

  if (isLoading) return <div className="container pb-24 pt-28 text-sm font-semibold text-text-muted">Loading article…</div>

  if (isError || !data) {
    return (
      <div className="container pb-24 pt-28 text-center">
        <SEO title="Article not found" description="We could not find that article." noindex />
        <h1 className="text-3xl font-black text-text-main">We could not find that article</h1>
        <Link to="/blog" className="btn btn-primary mt-6 inline-flex px-6">
          Back to the blog
        </Link>
      </div>
    )
  }

  const { post, more } = data
  const url = `https://www.jobwahala.com/blog/${post.slug}`

  return (
    <div className="pb-20 pt-24 xl:pt-28">
      <SEO
        title={post.title}
        description={post.metaDescription}
        canonical={url}
        ogType="article"
        ogImage={post.coverImageUrl ? new URL(post.coverImageUrl, 'https://www.jobwahala.com').toString() : undefined}
      />

      <div className="container max-w-3xl">
        <nav aria-label="Breadcrumb" className="mb-5 text-sm font-bold text-text-muted">
          <Link to="/" className="hover:text-secondary">Home</Link> &gt; <Link to="/blog" className="hover:text-secondary">Blog</Link> &gt; <span>{post.title}</span>
        </nav>

        <article>
          <Link to={`/blog?category=${post.category}`} className="text-[11px] font-black uppercase tracking-[0.2em] text-secondary">{post.categoryLabel}</Link>
          <h1 className="mt-3 text-3xl font-black leading-[1.1] tracking-tight text-text-main sm:text-5xl">{post.title}</h1>
          <p className="mt-4 text-sm font-semibold text-text-muted">
            By {post.authorName} · <time dateTime={post.publishedAt ?? undefined}>{formatDate(post.publishedAt)}</time> · {post.readingMinutes} min read
          </p>
          {post.coverImageUrl ? (
            <img src={post.coverImageUrl} alt={post.coverImageAlt ?? post.title} width={1200} height={675} fetchPriority="high" decoding="async" className="mt-8 h-auto w-full rounded-3xl object-cover" />
          ) : null}
          <div className="article-body mt-8" dangerouslySetInnerHTML={{ __html: post.html }} />
        </article>

        <p className="mt-10 flex flex-wrap items-center gap-3 text-sm font-black text-text-main">
          Share this article:
          {shareLinks(url, post.title).map(([name, href]) => (
            <a key={name} href={href} target="_blank" rel="noopener noreferrer" className="rounded-full border border-surface-border px-4 py-1.5 text-xs hover:border-primary hover:text-primary">
              {name}
            </a>
          ))}
        </p>

        <aside className="mt-10 rounded-3xl bg-primary p-7 text-white">
          <h2 className="text-xl font-black">Looking for work or hiring?</h2>
          <p className="mt-2 text-sm font-medium text-white/80">Browse real jobs from employers you can check, and get new jobs on your phone.</p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link to="/jobs" className="btn btn-gold px-5 py-2.5 text-sm">Browse open jobs</Link>
            <a href={whatsappChannelUrl()} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-xl border border-white/30 px-5 py-2.5 text-sm font-black hover:bg-white/10">
              <WhatsAppIcon /> Follow our WhatsApp channel
            </a>
          </div>
        </aside>

        {more.length > 0 ? (
          <section className="mt-12">
            <h2 className="mb-4 text-xl font-black text-text-main">More from the blog</h2>
            <ul className="space-y-3">
              {more.map((item) => (
                <li key={item.slug}>
                  <Link to={`/blog/${item.slug}`} className="font-bold text-primary hover:underline">{item.title}</Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <Link to="/blog" className="mt-10 inline-flex items-center gap-2 text-sm font-bold text-text-muted hover:text-secondary">
          <ArrowLeft className="h-4 w-4" /> All articles
        </Link>
      </div>
    </div>
  )
}
