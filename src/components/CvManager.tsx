import { useCallback, useEffect, useRef, useState } from 'react'
import { FileText, LoaderCircle, Upload } from 'lucide-react'
import { Link } from 'react-router-dom'
import EvidenceLink from './EvidenceLink'
import { apiClearBuilderCv, apiClearUploadedCv, apiGetMyCvFiles, apiSetUploadedCv } from '../lib/api'
import { formatShortDate } from '../lib/display'
import { getErrorMessage } from '../lib/errors'
import { cvUploadConstraints, toSiteRelativeUrl, uploadCvFile } from '../lib/evidenceUpload'

export type CvFile = { url: string; fileName: string; savedAt?: string | null }
export type CvFiles = { uploaded: CvFile | null; builder: CvFile | null }

/** Where a job seeker keeps the CV they uploaded and the one made by the CV builder. */
export default function CvManager() {
  const [files, setFiles] = useState<CvFiles | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const input = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    try {
      const res = (await apiGetMyCvFiles()) as { uploaded?: CvFile | null; builder?: CvFile | null }
      setFiles({ uploaded: res.uploaded ?? null, builder: res.builder ?? null })
    } catch (err) {
      setError(getErrorMessage(err, 'We could not load your CVs.'))
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const chooseFile = async (file: File | undefined) => {
    if (!file) return
    setError('')
    setBusy(true)
    try {
      const uploaded = await uploadCvFile(file)
      await apiSetUploadedCv({ url: toSiteRelativeUrl(uploaded.file.url), fileName: file.name })
      await load()
    } catch (err) {
      setError(getErrorMessage(err, 'We could not upload your CV. Please try again.'))
    } finally {
      setBusy(false)
      if (input.current) input.current.value = ''
    }
  }

  const remove = async (which: 'uploaded' | 'builder') => {
    setError('')
    setBusy(true)
    try {
      await (which === 'uploaded' ? apiClearUploadedCv() : apiClearBuilderCv())
      await load()
    } catch (err) {
      setError(getErrorMessage(err, 'We could not remove that CV. Please try again.'))
    } finally {
      setBusy(false)
    }
  }

  const row = (title: string, file: CvFile | null | undefined, which: 'uploaded' | 'builder') => (
    <div className="rounded-2xl border border-surface-border bg-white p-4">
      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-text-light">{title}</p>
      {file ? (
        <>
          <p className="mt-1 flex items-center gap-2 text-sm font-bold text-text-main">
            <FileText className="h-4 w-4 flex-none text-secondary" aria-hidden />
            <EvidenceLink href={file.url} className="min-w-0 truncate hover:underline">
              {file.fileName}
            </EvidenceLink>
          </p>
          <p className="mt-0.5 text-xs font-semibold text-text-muted">Saved {formatShortDate(file.savedAt)}</p>
          <button
            type="button"
            disabled={busy}
            onClick={() => void remove(which)}
            aria-label={`Remove ${title}`}
            className="mt-2 text-[10px] font-black uppercase tracking-widest text-error hover:underline disabled:opacity-60"
          >
            Remove
          </button>
        </>
      ) : which === 'builder' ? (
        <p className="mt-1 text-xs font-semibold text-text-muted">
          None yet. Make one in the{' '}
          <Link to="/cv-generator" className="font-bold text-primary hover:underline">
            CV builder
          </Link>{' '}
          and choose &quot;Use this CV for applications&quot;.
        </p>
      ) : (
        <p className="mt-1 text-xs font-semibold text-text-muted">None yet.</p>
      )}
    </div>
  )

  return (
    <div className="dashboard-panel p-5 sm:p-6">
      <div className="mb-4 border-b border-surface-border/50 pb-4">
        <h3 className="font-black text-[10px] uppercase tracking-widest text-text-main">My CV</h3>
        <p className="mt-1 text-xs font-medium leading-relaxed text-text-muted">
          Keep a CV here and choose which one to send when you apply. Only employers you apply to can download it.
        </p>
      </div>

      <div className="space-y-3">
        {row('Uploaded CV', files?.uploaded, 'uploaded')}
        {row('CV builder version', files?.builder, 'builder')}
      </div>

      <input
        ref={input}
        type="file"
        accept={cvUploadConstraints.accept}
        className="hidden"
        aria-label="Choose a CV file"
        onChange={(event) => void chooseFile(event.target.files?.[0])}
      />
      <button
        type="button"
        disabled={busy}
        onClick={() => input.current?.click()}
        className="btn btn-outline btn-sm mt-4 bg-white disabled:opacity-60"
      >
        {busy ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden /> : <Upload className="h-4 w-4" aria-hidden />}{' '}
        {files?.uploaded ? 'Replace my uploaded CV' : 'Upload a CV'}
      </button>
      <p className="mt-2 text-xs font-medium text-text-muted">PDF or Word (.docx), up to 3 MB. No macros or attachments.</p>

      {error ? (
        <p role="alert" className="mt-3 text-sm font-bold text-error">
          {error}
        </p>
      ) : null}
    </div>
  )
}
