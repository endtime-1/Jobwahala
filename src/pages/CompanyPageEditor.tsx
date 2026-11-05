import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { ImagePlus, Trash2 } from 'lucide-react'
import SEO from '../components/SEO'
import { useAuth } from '../context/AuthContext'
import { apiGetCompany, apiUpdateProfile } from '../lib/api'
import { getErrorMessage } from '../lib/errors'
import { uploadLogoFile } from '../lib/evidenceUpload'

const MAX_GALLERY = 6

/** Starter and Business plans: a cover image, a gallery and "Why work with us" on the public company page. */
export default function CompanyPageEditor() {
  const { user } = useAuth()
  const cover = useRef<HTMLInputElement | null>(null)
  const gallery = useRef<HTMLInputElement | null>(null)

  const [coverImageUrl, setCoverImageUrl] = useState('')
  const [images, setImages] = useState<string[]>([])
  const [why, setWhy] = useState('')
  const [needsPlan, setNeedsPlan] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  // Start from what the public page shows now (nothing is shown when the plan does not include it).
  useEffect(() => {
    if (!user) return
    let cancelled = false
    void (async () => {
      try {
        const data = (await apiGetCompany(user.id)) as { company: { isBranded?: boolean; coverImageUrl?: string | null; gallery?: string[]; whyWorkWithUs?: string | null } }
        if (cancelled) return
        setCoverImageUrl(data.company.coverImageUrl ?? '')
        setImages(data.company.gallery ?? [])
        setWhy(data.company.whyWorkWithUs ?? '')
        setNeedsPlan(!data.company.isBranded)
      } catch {
        // The form still works with empty fields.
      }
    })()
    return () => {
      cancelled = true
    }
  }, [user])

  const upload = async (event: ChangeEvent<HTMLInputElement>, done: (url: string) => void) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setError('')
    setSaved(false)
    setBusy(true)
    try {
      const data = await uploadLogoFile(file)
      done(String(data.file.url))
    } catch (err) {
      setError(getErrorMessage(err, 'We could not upload that picture.'))
    } finally {
      setBusy(false)
    }
  }

  const save = async (event: FormEvent) => {
    event.preventDefault()
    setError('')
    setSaved(false)
    setBusy(true)
    try {
      await apiUpdateProfile({ coverImageUrl, gallery: images, whyWorkWithUs: why.trim() })
      setSaved(true)
      setNeedsPlan(false)
    } catch (err) {
      if ((err as { code?: string }).code === 'PLAN_REQUIRED') setNeedsPlan(true)
      setError(getErrorMessage(err, 'We could not save your company page.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="container max-w-3xl pb-24 pt-28">
      <SEO title="Branded company page" noindex />
      <header className="mb-6">
        <h1 className="text-3xl font-black tracking-tight text-text-main">Branded company page</h1>
        <p className="mt-2 text-base font-medium text-text-muted">Show candidates what it is like to work with you. These appear on your public company page while your plan includes them.</p>
      </header>

      {needsPlan ? (
        <div role="alert" className="mb-6 rounded-2xl border border-gold/40 bg-gold/10 p-5">
          <p className="text-sm font-bold text-text-main">A branded page is part of the Starter and Business plans. You can prepare it here, but it only shows on your page once you are on one of them.</p>
          <Link to="/plans" className="btn btn-primary btn-sm mt-3 inline-flex">
            See plans
          </Link>
        </div>
      ) : null}

      <form onSubmit={(event) => void save(event)} className="space-y-6">
        <div>
          <p className="mb-2 text-xs font-black uppercase tracking-widest text-text-light">Cover image</p>
          {coverImageUrl ? <img src={coverImageUrl} alt="Cover" className="mb-3 h-40 w-full rounded-2xl object-cover" /> : null}
          <input ref={cover} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" aria-label="Upload cover image" onChange={(event) => void upload(event, setCoverImageUrl)} />
          <div className="flex gap-2">
            <button type="button" disabled={busy} onClick={() => cover.current?.click()} className="btn btn-outline btn-sm">
              <ImagePlus className="h-4 w-4" aria-hidden /> {coverImageUrl ? 'Change cover' : 'Upload cover'}
            </button>
            {coverImageUrl ? (
              <button type="button" onClick={() => setCoverImageUrl('')} className="btn btn-ghost btn-sm text-error">
                <Trash2 className="h-4 w-4" aria-hidden /> Remove
              </button>
            ) : null}
          </div>
        </div>

        <div>
          <p className="mb-2 text-xs font-black uppercase tracking-widest text-text-light">
            Gallery ({images.length} of {MAX_GALLERY})
          </p>
          <ul className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {images.map((src, index) => (
              <li key={src} className="relative overflow-hidden rounded-2xl border border-surface-border">
                <img src={src} alt={`Gallery ${index + 1}`} className="h-28 w-full object-cover" />
                <button type="button" onClick={() => setImages((current) => current.filter((item) => item !== src))} aria-label={`Remove gallery picture ${index + 1}`} className="absolute right-1 top-1 rounded-full bg-white/90 p-1 text-error">
                  <Trash2 className="h-4 w-4" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
          <input ref={gallery} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" aria-label="Add gallery picture" onChange={(event) => void upload(event, (url) => setImages((current) => [...current, url].slice(0, MAX_GALLERY)))} />
          <button type="button" disabled={busy || images.length >= MAX_GALLERY} onClick={() => gallery.current?.click()} className="btn btn-outline btn-sm disabled:opacity-60">
            <ImagePlus className="h-4 w-4" aria-hidden /> Add a picture
          </button>
        </div>

        <label className="block">
          <span className="mb-1.5 block text-xs font-black uppercase tracking-widest text-text-light">Why work with us</span>
          <textarea value={why} onChange={(event) => setWhy(event.target.value)} maxLength={2000} rows={6} className="w-full" placeholder="Your team, what you offer, and what a typical week looks like." />
        </label>

        {error ? (
          <p role="alert" className="text-sm font-bold text-error">
            {error}
          </p>
        ) : null}
        {saved ? (
          <p className="text-sm font-bold text-success">
            Saved.{' '}
            {user ? (
              <Link to={`/companies/${user.id}`} className="underline">
                View your public page
              </Link>
            ) : null}
          </p>
        ) : null}
        <button type="submit" disabled={busy} className="btn btn-primary disabled:opacity-60">
          {busy ? 'Working...' : 'Save company page'}
        </button>
      </form>
    </div>
  )
}
