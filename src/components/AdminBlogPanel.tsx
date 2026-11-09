import { useCallback, useEffect, useRef, useState, type ClipboardEvent, type FormEvent } from 'react'
import { Plus } from 'lucide-react'
import {
  apiAdminBlogCreate,
  apiAdminBlogDelete,
  apiAdminBlogList,
  apiAdminBlogUpdate,
  type AdminBlogInput,
  type AdminBlogPost,
  type BlogCategory,
} from '../lib/api'
import { getErrorMessage } from '../lib/errors'
import { hasRichStructure, htmlToMarkdown } from '../lib/htmlToMarkdown'
import { uploadLogoFile } from '../lib/evidenceUpload'

const input = 'mt-1 w-full rounded-xl border border-surface-border bg-white px-3 py-2.5 text-sm font-semibold text-text-main outline-none focus:border-primary'
const label = 'block text-[10px] font-black uppercase tracking-[0.2em] text-text-light'

const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100)

/** A date for the datetime-local input, in the admin's own time zone. */
const toLocalInput = (iso: string | null) => {
  if (!iso) return ''
  const date = new Date(iso)
  const shifted = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
  return shifted.toISOString().slice(0, 16)
}

const emptyForm = (): AdminBlogInput => ({
  title: '',
  slug: '',
  metaDescription: '',
  category: 'cv-tips',
  body: '',
  coverImageUrl: '',
  coverImageAlt: '',
  authorName: 'JobWahala Editorial',
  status: 'DRAFT',
  publishAt: '',
})

const STATE_STYLE: Record<AdminBlogPost['state'], string> = {
  DRAFT: 'bg-surface-alt text-text-muted',
  SCHEDULED: 'bg-amber-100 text-amber-800',
  PUBLISHED: 'bg-emerald-100 text-emerald-800',
}

/** Admin: write, save as a draft, schedule and publish blog posts. */
export default function AdminBlogPanel() {
  const [posts, setPosts] = useState<AdminBlogPost[]>([])
  const [categories, setCategories] = useState<BlogCategory[]>([])
  const [editingId, setEditingId] = useState<string | 'new' | null>(null)
  const [form, setForm] = useState<AdminBlogInput>(emptyForm())
  const [publishLocal, setPublishLocal] = useState('')
  const [slugTouched, setSlugTouched] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const bodyRef = useRef<HTMLTextAreaElement>(null)

  const load = useCallback(async () => {
    try {
      const data = await apiAdminBlogList()
      setPosts(data.posts)
      setCategories(data.categories)
    } catch (caught) {
      setError(getErrorMessage(caught, 'Could not load the blog posts.'))
    }
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0)
    return () => window.clearTimeout(timer)
  }, [load])

  const set = <K extends keyof AdminBlogInput>(key: K, value: AdminBlogInput[K]) => setForm((current) => ({ ...current, [key]: value }))

  const startNew = () => {
    setForm(emptyForm())
    setPublishLocal('')
    setSlugTouched(false)
    setEditingId('new')
    setMessage('')
    setError('')
  }

  const startEdit = (post: AdminBlogPost) => {
    setForm({
      title: post.title,
      slug: post.slug,
      metaDescription: post.metaDescription,
      category: post.category,
      body: post.body,
      coverImageUrl: post.coverImageUrl ?? '',
      coverImageAlt: post.coverImageAlt ?? '',
      authorName: post.authorName,
      status: post.status,
      publishAt: post.publishAt ?? '',
    })
    setPublishLocal(toLocalInput(post.publishAt))
    setSlugTouched(true)
    setEditingId(post.id)
    setMessage('')
    setError('')
  }

  const wrapSelection = (before: string, after = before) => {
    const area = bodyRef.current
    if (!area) return
    const { selectionStart: start, selectionEnd: end, value } = area
    set('body', `${value.slice(0, start)}${before}${value.slice(start, end) || 'text'}${after}${value.slice(end)}`)
  }

  const prefixLine = (prefix: string) => {
    const area = bodyRef.current
    if (!area) return
    const start = area.value.lastIndexOf('\n', area.selectionStart - 1) + 1
    set('body', `${area.value.slice(0, start)}${prefix}${area.value.slice(start)}`)
  }

  // Pasting from Word, Google Docs or a web page keeps the headings, bold, lists and links; pasted Markdown stays as it is.
  const onPaste = (event: ClipboardEvent<HTMLTextAreaElement>) => {
    const html = event.clipboardData.getData('text/html')
    if (!html || !hasRichStructure(html)) return
    event.preventDefault()
    const markdown = htmlToMarkdown(html)
    const area = event.currentTarget
    const { selectionStart: start, selectionEnd: end, value } = area
    set('body', `${value.slice(0, start)}${markdown}${value.slice(end)}`)
  }

  const uploadCover = async (file: File | undefined) => {
    if (!file) return
    setError('')
    try {
      const data = await uploadLogoFile(file)
      set('coverImageUrl', data.file.url)
    } catch (caught) {
      setError(getErrorMessage(caught, 'Could not upload the image (PNG, JPG or WEBP, 1 MB at most).'))
    }
  }

  const save = async (event: FormEvent | null, status: 'DRAFT' | 'PUBLISHED') => {
    event?.preventDefault()
    setBusy(true)
    setError('')
    setMessage('')
    try {
      const payload: AdminBlogInput = {
        ...form,
        slug: form.slug || slugify(form.title),
        status,
        publishAt: publishLocal ? new Date(publishLocal).toISOString() : '',
      }
      const result = editingId === 'new' || editingId === null ? await apiAdminBlogCreate(payload) : await apiAdminBlogUpdate(editingId, payload)
      const saved = result.post as AdminBlogPost
      setMessage(saved.state === 'PUBLISHED' ? 'Published.' : saved.state === 'SCHEDULED' ? 'Scheduled. It goes live at the chosen time.' : 'Saved as a draft.')
      setEditingId(saved.id)
      setForm((current) => ({ ...current, slug: saved.slug, status: saved.status, publishAt: saved.publishAt ?? '' }))
      setPublishLocal(toLocalInput(saved.publishAt))
      await load()
    } catch (caught) {
      setError(getErrorMessage(caught, 'Could not save the post.'))
    } finally {
      setBusy(false)
    }
  }

  const remove = async (post: AdminBlogPost) => {
    if (!window.confirm(`Delete "${post.title}"? This cannot be undone.`)) return
    try {
      await apiAdminBlogDelete(post.id)
      if (editingId === post.id) setEditingId(null)
      await load()
    } catch (caught) {
      setError(getErrorMessage(caught, 'Could not delete the post.'))
    }
  }

  const toolButton = 'rounded-lg border border-surface-border bg-white px-3 py-1.5 text-xs font-black text-text-main hover:border-primary'

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-black text-text-main">Blog</h2>
          <p className="text-sm font-semibold text-text-muted">Write posts, save drafts, schedule or publish. Published posts appear at /blog and in the sitemap.</p>
        </div>
        <button type="button" onClick={startNew} className="btn btn-primary inline-flex items-center gap-2 px-5 py-2.5 text-xs">
          <Plus className="h-4 w-4" /> New post
        </button>
      </div>

      {error ? <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{error}</p> : null}
      {message ? <p role="status" className="rounded-xl bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800">{message}</p> : null}

      {editingId ? (
        <form onSubmit={(event) => void save(event, 'DRAFT')} className="space-y-4 rounded-3xl border border-surface-border bg-surface-alt/20 p-5" aria-label="Blog post">
          <div className="grid gap-4 md:grid-cols-2">
            <label className={label}>
              Title
              <input
                className={input}
                value={form.title}
                maxLength={120}
                onChange={(event) => {
                  set('title', event.target.value)
                  if (!slugTouched) set('slug', slugify(event.target.value))
                }}
              />
            </label>
            <label className={label}>
              URL slug
              <input
                className={input}
                value={form.slug}
                maxLength={100}
                onChange={(event) => {
                  setSlugTouched(true)
                  set('slug', slugify(event.target.value))
                }}
              />
              <span className="mt-1 block normal-case tracking-normal text-text-muted">jobwahala.com/blog/{form.slug || 'your-slug'}</span>
            </label>
          </div>

          <label className={label}>
            Meta description ({form.metaDescription.length}/160)
            <textarea className={input} rows={2} maxLength={160} value={form.metaDescription} onChange={(event) => set('metaDescription', event.target.value)} />
          </label>

          <div className="grid gap-4 md:grid-cols-2">
            <label className={label}>
              Category
              <select className={input} value={form.category} onChange={(event) => set('category', event.target.value)}>
                {categories.map((category) => (
                  <option key={category.slug} value={category.slug}>
                    {category.label}
                  </option>
                ))}
              </select>
            </label>
            <label className={label}>
              Author
              <input className={input} value={form.authorName} maxLength={80} onChange={(event) => set('authorName', event.target.value)} />
            </label>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className={label}>
                Cover image address
                <input className={input} value={form.coverImageUrl} placeholder="Upload below or paste an https address" onChange={(event) => set('coverImageUrl', event.target.value)} />
              </label>
              <label className="mt-2 inline-block cursor-pointer text-xs font-black text-primary">
                Upload an image (PNG, JPG or WEBP, 1 MB)
                <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(event) => void uploadCover(event.target.files?.[0])} />
              </label>
            </div>
            <label className={label}>
              Cover image alt text
              <input className={input} value={form.coverImageAlt} maxLength={200} placeholder="Describe the picture" onChange={(event) => set('coverImageAlt', event.target.value)} />
            </label>
          </div>
          {form.coverImageUrl ? <img src={form.coverImageUrl} alt={form.coverImageAlt || 'Cover preview'} width={320} height={180} className="h-auto max-w-xs rounded-xl border border-surface-border" /> : null}

          <div>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className={label}>Article</span>
              <button type="button" className={toolButton} onClick={() => prefixLine('## ')}>H2</button>
              <button type="button" className={toolButton} onClick={() => prefixLine('### ')}>H3</button>
              <button type="button" className={toolButton} onClick={() => wrapSelection('**')}>Bold</button>
              <button type="button" className={toolButton} onClick={() => prefixLine('- ')}>List</button>
              <button type="button" className={toolButton} onClick={() => wrapSelection('[', '](https://)')}>Link</button>
            </div>
            <textarea
              ref={bodyRef}
              aria-label="Article"
              className={`${input} min-h-[22rem] font-mono`}
              value={form.body}
              onChange={(event) => set('body', event.target.value)}
              onPaste={onPaste}
              placeholder="Write in Markdown, or paste from Word or Google Docs: headings, bold, lists and links are kept."
            />
          </div>

          <label className={label}>
            Publish date and time (leave empty to publish now; a later time schedules it)
            <input type="datetime-local" className={input} value={publishLocal} onChange={(event) => setPublishLocal(event.target.value)} />
          </label>

          <div className="flex flex-wrap gap-3">
            <button type="submit" disabled={busy} className="rounded-xl border border-surface-border bg-white px-5 py-2.5 text-xs font-black text-text-main disabled:opacity-50">
              Save as draft
            </button>
            <button type="button" disabled={busy} onClick={() => void save(null, 'PUBLISHED')} className="btn btn-primary px-5 py-2.5 text-xs disabled:opacity-50">
              {publishLocal && new Date(publishLocal) > new Date() ? 'Schedule' : 'Publish'}
            </button>
            <button type="button" onClick={() => setEditingId(null)} className="rounded-xl px-5 py-2.5 text-xs font-black text-text-muted">
              Close
            </button>
          </div>
        </form>
      ) : null}

      <div className="space-y-3">
        {posts.length === 0 ? <p className="rounded-2xl border border-dashed border-surface-border p-6 text-sm font-semibold text-text-light">No posts yet.</p> : null}
        {posts.map((post) => (
          <div key={post.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-surface-border bg-white p-4">
            <div className="min-w-0">
              <p className="truncate text-base font-black text-text-main">{post.title}</p>
              <p className="text-xs font-semibold text-text-muted">
                /blog/{post.slug} · {post.category} · {post.wordCount} words
                {post.publishAt ? ` · ${new Date(post.publishAt).toLocaleString('en-GB')}` : ''}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.15em] ${STATE_STYLE[post.state]}`}>{post.state}</span>
              {post.state === 'PUBLISHED' ? (
                <a href={`/blog/${post.slug}`} target="_blank" rel="noreferrer" className="text-xs font-black text-primary">View</a>
              ) : null}
              <button type="button" onClick={() => startEdit(post)} className="rounded-lg border border-surface-border px-3 py-1.5 text-xs font-black text-text-main hover:border-primary">Edit</button>
              <button type="button" onClick={() => void remove(post)} className="rounded-lg px-3 py-1.5 text-xs font-black text-red-600">Delete</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
