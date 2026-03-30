import { useRef, useState, type ChangeEvent } from 'react'
import { Link2, LoaderCircle, Paperclip, UploadCloud } from 'lucide-react'
import {
  evidenceUploadConstraints,
  type EvidenceUploadCategory,
  uploadEvidenceFile,
} from '../lib/evidenceUpload'

type EvidenceUploadFieldProps = {
  category: EvidenceUploadCategory
  label: string
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  placeholder?: string
  helperText?: string
}

const formatSupportedTypes = () =>
  evidenceUploadConstraints.supportedContentTypes
    .map((type) => {
      if (type === 'application/pdf') return 'PDF'
      if (type === 'image/jpeg') return 'JPG'
      return type.split('/')[1].toUpperCase()
    })
    .join(', ')

export default function EvidenceUploadField({
  category,
  label,
  value,
  onChange,
  disabled = false,
  placeholder = 'https://...',
  helperText,
}: EvidenceUploadFieldProps) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [uploadedFileName, setUploadedFileName] = useState('')

  const handleUploadClick = () => {
    if (!disabled && !isUploading) {
      inputRef.current?.click()
    }
  }

  const handleFileSelected = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''

    if (!file) {
      return
    }

    setUploadError('')
    setIsUploading(true)

    try {
      const response = await uploadEvidenceFile(category, file)
      onChange(response.file.url)
      setUploadedFileName(response.file.originalFileName || file.name)
    } catch (error: any) {
      setUploadError(error.message || 'Unable to upload evidence right now')
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <div>
      <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-text-light">
        {label}
      </label>
      <input
        type="url"
        value={value}
        onChange={(event) => {
          setUploadError('')
          setUploadedFileName('')
          onChange(event.target.value)
        }}
        disabled={disabled || isUploading}
        className="mt-2 h-12 w-full rounded-2xl border border-surface-border bg-surface px-4 text-sm text-text-main outline-none focus:border-primary disabled:opacity-60"
        placeholder={placeholder}
      />

      <input
        ref={inputRef}
        type="file"
        accept={evidenceUploadConstraints.supportedContentTypes.join(',')}
        className="hidden"
        onChange={(event) => void handleFileSelected(event)}
      />

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={handleUploadClick}
          disabled={disabled || isUploading}
          className="inline-flex items-center gap-2 rounded-2xl border border-surface-border bg-white px-4 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-text-main transition hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isUploading ? (
            <>
              <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
              Uploading
            </>
          ) : (
            <>
              <UploadCloud className="h-3.5 w-3.5" />
              Upload File
            </>
          )}
        </button>

        {value ? (
          <a
            href={value}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-primary hover:underline"
          >
            <Link2 className="h-3.5 w-3.5" />
            Open linked evidence
          </a>
        ) : null}
      </div>

      <div className="mt-3 flex flex-col gap-2">
        {uploadedFileName ? (
          <p className="inline-flex items-center gap-2 text-xs font-semibold text-text-muted">
            <Paperclip className="h-3.5 w-3.5" />
            Uploaded: {uploadedFileName}
          </p>
        ) : null}
        {helperText ? (
          <p className="text-xs font-semibold text-text-light">{helperText}</p>
        ) : null}
        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-text-light">
          {formatSupportedTypes()} / max 5 MB
        </p>
        {uploadError ? (
          <p className="text-xs font-semibold text-error">{uploadError}</p>
        ) : null}
      </div>
    </div>
  )
}
