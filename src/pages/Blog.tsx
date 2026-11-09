import { useQuery } from '@tanstack/react-query'
import { Link, useSearchParams } from 'react-router-dom'
import PageHero from '../components/PageHero'
import SEO from '../components/SEO'
import { apiGetBlogPosts } from '../lib/api'

const formatDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '')

export default function Blog() {
  const [params, setParams] = useSearchParams()
  const category = params.get('category') ?? ''
  const { data, isLoading, isError } = useQuery({ queryKey: ['blog', category], queryFn: () => apiGetBlogPosts(category || undefined) })
  const categories = data?.categories ?? []
  const label = categories.find((entry) => entry.slug === category)?.label

  return (
    <div className="pt-24 pb-20 md:pb-24 xl:pt-28 xl:pb-32">
      <SEO
        title={label ? `${label} – Blog` : 'Blog – Career Advice for Job Seekers and Employers in Ghana'}
        description="CV tips, interview tips, scam alerts, National Service and graduate advice, and hiring advice for employers in Ghana. Written by the JobWahala team."
      />

      <div className="container">
        <PageHero eyebrow="Blog" title={label ?? 'JobWahala Blog'} className="mb-10">
          <p className="mt-4 max-w-2xl text-base font-medium text-white/75 sm:text-lg">
            Practical advice for finding a job, avoiding scams and hiring well in Ghana and across Africa.
          </p>
        </PageHero>

        <nav aria-label="Categories" className="mb-10 flex flex-wrap gap-3">
          {[{ slug: '', label: 'All' }, ...categories].map((entry) => (
            <button
              key={entry.slug || 'all'}
              type="button"
              onClick={() => setParams(entry.slug ? { category: entry.slug } : {})}
              aria-pressed={category === entry.slug}
              className={`rounded-full px-4 py-2 text-sm font-bold transition-all ${category === entry.slug ? 'bg-primary text-white' : 'bg-surface-alt text-text-muted hover:bg-surface-border'}`}
            >
              {entry.label}
            </button>
          ))}
        </nav>

        {isLoading ? <p className="text-sm font-semibold text-text-muted">Loading articles…</p> : null}
        {isError ? <p role="alert" className="text-sm font-bold text-red-600">We could not load the articles. Please try again.</p> : null}
        {data && data.posts.length === 0 ? <p className="rounded-2xl border border-dashed border-surface-border p-8 text-sm font-semibold text-text-muted">No articles here yet. Check back soon.</p> : null}

        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          {data?.posts.map((post) => (
            <article key={post.slug} className="overflow-hidden rounded-[2rem] border border-surface-border bg-white shadow-sm">
              {post.coverImageUrl ? (
                <Link to={`/blog/${post.slug}`} className="block aspect-video overflow-hidden">
                  <img src={post.coverImageUrl} alt={post.coverImageAlt ?? post.title} width={800} height={450} loading="lazy" decoding="async" className="h-full w-full object-cover" />
                </Link>
              ) : null}
              <div className="p-6">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-secondary">
                  {post.categoryLabel} · {formatDate(post.publishedAt)}
                </p>
                <h2 className="mt-2 text-xl font-black leading-snug text-text-main">
                  <Link to={`/blog/${post.slug}`} className="hover:text-primary">{post.title}</Link>
                </h2>
                <p className="mt-2 line-clamp-3 text-sm font-medium text-text-muted">{post.excerpt}</p>
                <p className="mt-4 text-xs font-bold text-text-light">
                  {post.authorName} · {post.readingMinutes} min read
                </p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </div>
  )
}
