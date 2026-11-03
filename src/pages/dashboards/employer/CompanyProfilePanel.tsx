import { useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { Building2, ChevronDown, ImagePlus, LoaderCircle, Trash2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import CompanyLogo from '../../../components/CompanyLogo'
import { useAuth } from '../../../context/AuthContext'
import { apiUpdateProfile } from '../../../lib/api'
import { maxLogoFileBytes, uploadLogoFile } from '../../../lib/evidenceUpload'
import { getErrorMessage } from '../../../lib/errors'

export default function CompanyProfilePanel() {
  const { user, refreshUser } = useAuth()
  const profile = user?.employerProfile
  const fileInput = useRef<HTMLInputElement | null>(null)

  const [isOpen, setIsOpen] = useState(false)
  const [companyName, setCompanyName] = useState(profile?.companyName ?? '')
  const [industry, setIndustry] = useState(profile?.industry ?? '')
  const [website, setWebsite] = useState(profile?.website ?? '')
  const [description, setDescription] = useState(profile?.description ?? '')
  const [logoUrl, setLogoUrl] = useState(profile?.logoUrl ?? '')
  const [isUploading, setIsUploading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  const displayName = companyName.trim() || profile?.companyName || 'Your company'

  const onLogoChosen = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    setError('')
    setSaved(false)
    setIsUploading(true)
    try {
      const data = await uploadLogoFile(file)
      setLogoUrl(String(data.file.url))
    } catch (err) {
      setError(getErrorMessage(err, 'Unable to upload that logo.'))
    } finally {
      setIsUploading(false)
    }
  }

  const save = async (event: FormEvent) => {
    event.preventDefault()
    if (!companyName.trim()) {
      setError('Add your company name first.')
      return
    }

    setError('')
    setSaved(false)
    setIsSaving(true)
    try {
      await apiUpdateProfile({
        companyName: companyName.trim(),
        industry: industry.trim(),
        website: website.trim(),
        description: description.trim(),
        logoUrl,
      })
      await refreshUser()
      setSaved(true)
    } catch (err) {
      setError(getErrorMessage(err, 'Unable to save your company profile.'))
    } finally {
      setIsSaving(false)
    }
  }

  if (!user) return null

  return (
    <section className="dashboard-panel mb-8 p-4 sm:p-6" aria-label="Company profile">
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-expanded={isOpen}
        className="flex w-full items-center justify-between gap-4 text-left"
      >
        <span className="flex min-w-0 items-center gap-4">
          <CompanyLogo name={displayName} logoUrl={profile?.logoUrl} className="h-12 w-12 rounded-2xl text-base" />
          <span className="min-w-0">
            <span className="block truncate text-base font-black text-text-main">{displayName}</span>
            <span className="block text-xs font-semibold text-text-muted">
              {profile?.logoUrl ? 'Edit your company profile' : 'Add your logo so candidates recognise you'}
            </span>
          </span>
        </span>
        <ChevronDown className={`h-5 w-5 flex-none text-text-light transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <form onSubmit={(event) => void save(event)} className="mt-6 space-y-5 border-t border-surface-border/60 pt-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <CompanyLogo name={displayName} logoUrl={logoUrl} className="h-20 w-20 rounded-3xl text-2xl" />
            <div className="space-y-2">
              <input
                ref={fileInput}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                aria-label="Upload company logo"
                onChange={(event) => void onLogoChosen(event)}
              />
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => fileInput.current?.click()}
                  disabled={isUploading}
                  className="btn btn-outline btn-sm"
                >
                  {isUploading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
                  {logoUrl ? 'Change logo' : 'Upload logo'}
                </button>
                {logoUrl && (
                  <button type="button" onClick={() => setLogoUrl('')} className="btn btn-ghost btn-sm text-error">
                    <Trash2 className="h-4 w-4" /> Remove
                  </button>
                )}
              </div>
              <p className="text-xs font-medium text-text-muted">
                PNG, JPG or WEBP, up to {Math.round(maxLogoFileBytes / (1024 * 1024))} MB. A square image looks best. Save to publish.
              </p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-xs font-black uppercase tracking-widest text-text-light">Company name</span>
              <input value={companyName} onChange={(event) => setCompanyName(event.target.value)} maxLength={120} required />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-black uppercase tracking-widest text-text-light">Industry</span>
              <input value={industry} onChange={(event) => setIndustry(event.target.value)} maxLength={120} placeholder="e.g. Hospitality" />
            </label>
            <label className="block sm:col-span-2">
              <span className="mb-1.5 block text-xs font-black uppercase tracking-widest text-text-light">Website</span>
              <input value={website} onChange={(event) => setWebsite(event.target.value)} maxLength={500} placeholder="www.yourcompany.com" />
            </label>
            <label className="block sm:col-span-2">
              <span className="mb-1.5 block text-xs font-black uppercase tracking-widest text-text-light">About your company</span>
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                maxLength={2000}
                rows={4}
                placeholder="What you do, who you hire and what it is like to work with you."
              />
            </label>
          </div>

          {error && <p role="alert" className="text-sm font-bold text-error">{error}</p>}
          {saved && (
            <p className="text-sm font-bold text-success">
              Saved.{' '}
              <Link to={`/companies/${user.id}`} className="underline">
                View your public page
              </Link>
            </p>
          )}

          <button type="submit" disabled={isSaving || isUploading} className="btn btn-primary">
            <Building2 className="h-4 w-4" /> {isSaving ? 'Saving…' : 'Save company profile'}
          </button>
        </form>
      )}
    </section>
  )
}
