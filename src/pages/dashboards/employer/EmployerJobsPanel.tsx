import { useEffect, useRef, useState } from 'react'
import { ChevronRight, Sparkles } from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import { apiCreateJob, apiGenerateJobDraft } from '../../../lib/api'
import { latestClosingDate, toDateInputValue } from '../../../lib/jobLifecycle'
import EmployerJobCard from './EmployerJobCard'
import type { EmployerJob, JobCopilotDraft } from './types'
import { makeInitialJobForm, toJobPayload } from './utils'
import { earlyCareerTypes, isEarlyCareerType } from '../../../lib/earlyCareer'
import EarlyCareerFields from './EarlyCareerFields'
import { getErrorMessage } from '../../../lib/errors'

type Props = {
  jobs: EmployerJob[]
  showCreateForm: boolean
  onToggleCreateForm: () => void
  onJobCreated: () => void
  onReviewApplicants: (jobId: string, jobTitle: string) => void
}

export default function EmployerJobsPanel({
  jobs,
  showCreateForm,
  onToggleCreateForm,
  onJobCreated,
  onReviewApplicants,
}: Props) {
  const [jobForm, setJobForm] = useState(makeInitialJobForm)
  const formRef = useRef<HTMLFormElement>(null)
  // The expiry email links to /dashboard?extend=<job id>: show that job with its Extend control open.
  const [searchParams] = useSearchParams()
  const extendJobId = searchParams.get('extend')
  const [jobCopilotDraft, setJobCopilotDraft] = useState<JobCopilotDraft | null>(null)
  const [isCreatingJob, setIsCreatingJob] = useState(false)
  const [isGeneratingJobDraft, setIsGeneratingJobDraft] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (extendJobId) document.getElementById(`job-${extendJobId}`)?.scrollIntoView?.({ block: 'center' })
  }, [extendJobId, jobs.length])

  const createJob = async (asDraft: boolean) => {
    setError('')
    setIsCreatingJob(true)

    try {
      const payload = toJobPayload(jobForm)
      await apiCreateJob(asDraft ? { ...payload, status: 'DRAFT' } : payload)
      setJobForm(makeInitialJobForm())
      setJobCopilotDraft(null)
      onToggleCreateForm()
      onJobCreated()
    } catch (err) {
      setError(getErrorMessage(err, 'Unable to create job right now.'))
    } finally {
      setIsCreatingJob(false)
    }
  }

  const handleCreateJob = (event: React.FormEvent) => {
    event.preventDefault()
    void createJob(false)
  }

  const handleSaveDraft = () => {
    if (formRef.current && !formRef.current.reportValidity()) return
    void createJob(true)
  }

  const handleGenerateJobDraft = async () => {
    setError('')
    setIsGeneratingJobDraft(true)

    try {
      // The closing date is not part of the writing help.
      const { closesAt: _closesAt, salaryMin: _salaryMin, salaryMax: _salaryMax, unpaid: _unpaid, durationMonths: _months, startMode: _startMode, startDate: _startDate, schedule: _schedule, possibleJobOffer: _offer, ...draftInput } = jobForm
      const data = await apiGenerateJobDraft({
        ...draftInput,
        focus: jobForm.description || undefined,
      })
      const draft = (data.draft || {}) as Partial<typeof jobForm> & JobCopilotDraft
      setJobForm((current) => ({
        ...current,
        title: draft.title || current.title,
        description: draft.description || current.description,
        location: draft.location || current.location,
        type: draft.type || current.type,
        salary: draft.salary || current.salary,
        category: draft.category || current.category,
      }))
      setJobCopilotDraft({
        positioning: draft.positioning || '',
        hiringNote: draft.hiringNote || '',
      })
    } catch (err) {
      setError(getErrorMessage(err, 'Unable to generate a job draft right now.'))
    } finally {
      setIsGeneratingJobDraft(false)
    }
  }

  return (
    <>
      {error ? (
        <div className="mb-4 rounded-2xl border border-error/10 bg-error/5 px-4 py-3 text-sm font-semibold text-error">
          {error}
        </div>
      ) : null}

      {showCreateForm ? (
        <form ref={formRef} onSubmit={handleCreateJob} className="space-y-6 rounded-2xl border border-secondary/30 bg-white p-5 sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-surface-border pb-5">
            <div>
              <h2 className="text-2xl font-black tracking-tight text-text-main">Create Job Posting</h2>
              <p className="mt-1 text-sm font-medium text-text-muted">Fill in the basics. Your job goes live as soon as you publish, or save it as a draft first.</p>
            </div>
            <span className="rounded-full bg-success/15 px-3 py-1 text-sm font-extrabold text-success">Goes live instantly</span>
          </div>

          <div className="flex flex-col gap-4 rounded-xl bg-secondary/5 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-secondary/10 text-secondary">
                <Sparkles className="h-5 w-5" />
              </span>
              <div>
                <p className="font-extrabold text-text-main">Hiring Copilot</p>
                <p className="text-sm font-medium text-text-muted">
                  Type a few words about the role, then let AI write a clear job post you can edit.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleGenerateJobDraft}
              disabled={isGeneratingJobDraft}
              className="btn btn-secondary btn-sm flex-none px-5 disabled:opacity-60"
            >
              {isGeneratingJobDraft ? 'Generating...' : 'Generate AI Job Draft'}
            </button>
          </div>
          {jobCopilotDraft ? (
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-xl border border-surface-border bg-surface-alt/40 p-4">
                <p className="text-sm font-bold text-text-muted">Positioning</p>
                <p className="mt-1 text-sm font-semibold leading-relaxed text-text-main">
                  {jobCopilotDraft.positioning || 'No positioning note yet.'}
                </p>
              </div>
              <div className="rounded-xl border border-surface-border bg-surface-alt/40 p-4">
                <p className="text-sm font-bold text-text-muted">Hiring note</p>
                <p className="mt-1 text-sm font-semibold leading-relaxed text-text-main">
                  {jobCopilotDraft.hiringNote || 'No hiring note yet.'}
                </p>
              </div>
            </div>
          ) : null}

          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <div className="space-y-1.5">
              <label htmlFor="job-title" className="block text-base font-bold text-text-main">Job title</label>
              <input id="job-title" type="text" placeholder="Job title" value={jobForm.title} onChange={(e) => setJobForm((c) => ({ ...c, title: e.target.value }))} className="h-14 text-base font-semibold" required />
              <p className="text-sm text-text-muted">For example: Customer support agent</p>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="job-location" className="block text-base font-bold text-text-main">Where is the job?</label>
              <input id="job-location" type="text" placeholder="Location or work mode (Remote, Hybrid, Accra)" value={jobForm.location} onChange={(e) => setJobForm((c) => ({ ...c, location: e.target.value }))} className="h-14 text-base font-semibold" />
              <p className="text-sm text-text-muted">A town, or Remote. Applicants filter by this.</p>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="job-type" className="block text-base font-bold text-text-main">Type of work</label>
              <select id="job-type" value={jobForm.type} onChange={(e) => setJobForm((c) => ({ ...c, type: e.target.value }))} className="h-14 text-base font-semibold">
                <option>Full-time</option>
                <option>Part-time</option>
                <option>Contract</option>
                <option>Freelance</option>
                {earlyCareerTypes.map((type) => (
                  <option key={type}>{type}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <p className="block text-base font-bold text-text-main">{isEarlyCareerType(jobForm.type) ? 'Stipend (GHS a month)' : 'Pay (GHS a month)'}</p>
              <div className="grid grid-cols-2 gap-3">
                <input
                  id="job-salary-min"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  placeholder="From, e.g. 3000"
                  aria-label="Pay from (GHS a month)"
                  value={jobForm.salaryMin}
                  disabled={jobForm.unpaid && isEarlyCareerType(jobForm.type)}
                  onChange={(e) => setJobForm((c) => ({ ...c, salaryMin: e.target.value }))}
                  className="h-14 text-base font-semibold"
                />
                <input
                  id="job-salary-max"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  placeholder="To (optional)"
                  aria-label="Pay to (GHS a month)"
                  value={jobForm.salaryMax}
                  disabled={jobForm.unpaid && isEarlyCareerType(jobForm.type)}
                  onChange={(e) => setJobForm((c) => ({ ...c, salaryMax: e.target.value }))}
                  className="h-14 text-base font-semibold"
                />
              </div>
              <p className="text-sm text-text-muted">Candidates can search by pay, so give numbers if you can.</p>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="job-salary" className="block text-base font-bold text-text-main">Pay as shown on the job</label>
              <input id="job-salary" type="text" placeholder="Salary" value={jobForm.salary} onChange={(e) => setJobForm((c) => ({ ...c, salary: e.target.value }))} className="h-14 text-base font-semibold" />
              <p className="text-sm text-text-muted">Optional. Left empty, we write it from the numbers, e.g. GHS 3,000 - 4,500 a month.</p>
            </div>
            <EarlyCareerFields form={jobForm} onChange={(patch) => setJobForm((c) => ({ ...c, ...patch }))} />
            <div className="space-y-1.5">
              <label htmlFor="job-closes" className="block text-base font-bold text-text-main">Closing date</label>
              <input
                id="job-closes"
                type="date"
                value={jobForm.closesAt}
                min={toDateInputValue(new Date())}
                max={latestClosingDate()}
                onChange={(e) => setJobForm((c) => ({ ...c, closesAt: e.target.value }))}
                className="h-14 text-base font-semibold"
                required
              />
              <p className="text-sm text-text-muted">The last day people can apply. Up to 90 days from today; we suggest 30.</p>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="job-category" className="block text-base font-bold text-text-main">Field</label>
              <input id="job-category" type="text" placeholder="Category" value={jobForm.category} onChange={(e) => setJobForm((c) => ({ ...c, category: e.target.value }))} className="h-14 text-base font-semibold" />
              <p className="text-sm text-text-muted">For example: Sales, Design, Finance or Technology.</p>
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="job-description" className="block text-base font-bold text-text-main">About the job</label>
            <textarea
              id="job-description"
              placeholder="Describe the role, responsibilities, and expectations..."
              value={jobForm.description}
              onChange={(e) => setJobForm((c) => ({ ...c, description: e.target.value }))}
              className="min-h-[180px] py-4 text-base font-semibold"
              required
            />
            <p className="text-sm text-text-muted">What will the person do each day, and what do they need to know or have done before?</p>
          </div>

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm font-medium text-text-muted">Clear pay and location help the right people apply.</p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <button type="button" onClick={handleSaveDraft} disabled={isCreatingJob} className="btn btn-outline btn-lg bg-white px-6 disabled:opacity-60">
                Save as draft
              </button>
              <button type="submit" disabled={isCreatingJob} className="btn btn-gold btn-lg px-8 disabled:opacity-60">
                {isCreatingJob ? 'Publishing...' : 'Publish Job'}
              </button>
            </div>
          </div>
        </form>
      ) : null}

      <section className="dashboard-panel p-5 sm:p-7 lg:p-8">
        <div className="flex justify-between items-center mb-10 pb-6 border-b border-surface-border/50">
          <h2 className="font-black text-xs uppercase tracking-[0.2em] text-text-main">Posted Positions</h2>
          <Link to="/jobs" className="text-[10px] font-black text-primary uppercase tracking-widest hover:underline flex items-center gap-2">
            Open Jobs Board <ChevronRight className="h-4 w-4" />
          </Link>
        </div>

        {jobs.length === 0 ? (
          <div className="rounded-xl border border-dashed border-surface-border p-8 text-center">
            <p className="text-lg font-extrabold text-text-main">No jobs posted yet.</p>
            <p className="mx-auto mt-1 max-w-md text-sm font-medium text-text-muted">
              Post your first job in a few minutes. People across Africa can apply as soon as it is live.
            </p>
            {showCreateForm ? null : (
              <button type="button" onClick={onToggleCreateForm} className="btn btn-gold mt-5 px-6">
                Post your first job
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {jobs.map((job) => (
              <EmployerJobCard
                key={job.id}
                job={job}
                highlighted={job.id === extendJobId}
                onChanged={onJobCreated}
                onReviewApplicants={onReviewApplicants}
              />
            ))}
          </div>
        )}
      </section>
    </>
  )
}
