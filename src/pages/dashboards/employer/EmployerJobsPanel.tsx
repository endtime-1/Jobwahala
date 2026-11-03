import { useState } from 'react'
import { ChevronRight, Clock, Sparkles } from 'lucide-react'
import { Link } from 'react-router-dom'
import { apiCreateJob, apiGenerateJobDraft, apiUpdateJobStatus } from '../../../lib/api'
import { emailHandle, formatRelativeTime } from '../../../lib/display'
import type { EmployerJob, JobCopilotDraft } from './types'
import { initialJobForm } from './utils'
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
  const [jobForm, setJobForm] = useState(initialJobForm)
  const [jobCopilotDraft, setJobCopilotDraft] = useState<JobCopilotDraft | null>(null)
  const [isCreatingJob, setIsCreatingJob] = useState(false)
  const [isGeneratingJobDraft, setIsGeneratingJobDraft] = useState(false)
  const [isUpdatingJobStatus, setIsUpdatingJobStatus] = useState(false)
  const [error, setError] = useState('')

  const handleCreateJob = async (event: React.FormEvent) => {
    event.preventDefault()
    setError('')
    setIsCreatingJob(true)

    try {
      await apiCreateJob(jobForm)
      setJobForm(initialJobForm)
      setJobCopilotDraft(null)
      onToggleCreateForm()
      onJobCreated()
    } catch (err) {
      setError(getErrorMessage(err, 'Unable to create job right now.'))
    } finally {
      setIsCreatingJob(false)
    }
  }

  const handleGenerateJobDraft = async () => {
    setError('')
    setIsGeneratingJobDraft(true)

    try {
      const data = await apiGenerateJobDraft({
        ...jobForm,
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

  const handleJobStatusUpdate = async (jobId: string, status: string) => {
    setError('')
    setIsUpdatingJobStatus(true)

    try {
      await apiUpdateJobStatus(jobId, status)
      onJobCreated() // triggers refetch
    } catch (err) {
      setError(getErrorMessage(err, 'Unable to update this job status right now.'))
    } finally {
      setIsUpdatingJobStatus(false)
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
        <form onSubmit={handleCreateJob} className="space-y-6 rounded-2xl border border-secondary/30 bg-white p-5 sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-surface-border pb-5">
            <div>
              <h2 className="text-2xl font-black tracking-tight text-text-main">Create Job Posting</h2>
              <p className="mt-1 text-sm font-medium text-text-muted">Fill in the basics. Your job goes live as soon as you publish.</p>
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
              </select>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="job-salary" className="block text-base font-bold text-text-main">Pay</label>
              <input id="job-salary" type="text" placeholder="Salary" value={jobForm.salary} onChange={(e) => setJobForm((c) => ({ ...c, salary: e.target.value }))} className="h-14 text-base font-semibold" />
              <p className="text-sm text-text-muted">Include the currency, e.g. GHS 3,000 - 4,500 a month.</p>
            </div>
            <div className="space-y-1.5 md:col-span-2">
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
            <button type="submit" disabled={isCreatingJob} className="btn btn-gold btn-lg px-8 disabled:opacity-60">
              {isCreatingJob ? 'Publishing...' : 'Publish Job'}
            </button>
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
              <div
                key={job.id}
                className="rounded-2xl border border-surface-border bg-white p-5 transition-all hover:border-secondary/40 sm:p-6"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <h3 className="text-xl font-extrabold leading-snug tracking-tight text-text-main">{job.title}</h3>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-extrabold ${
                          job.status === 'ACTIVE' ? 'bg-success/15 text-success' : 'bg-surface-alt text-text-muted'
                        }`}
                      >
                        {job.status}
                      </span>
                      {job.postedByAdmin ? (
                        <span className="rounded-full bg-secondary/10 px-3 py-1 text-xs font-extrabold text-secondary">Admin assisted</span>
                      ) : null}
                      <span className="flex items-center gap-1.5 text-sm font-semibold text-text-muted">
                        <Clock className="h-3.5 w-3.5" /> {formatRelativeTime(job.createdAt)}
                      </span>
                    </div>
                    {job.postedByAdmin ? (
                      <p className="mt-2 text-sm font-semibold text-text-muted">
                        Posted by JobWahala admin / {emailHandle(job.postedByAdmin.email)}
                      </p>
                    ) : null}
                  </div>
                  <div className="rounded-xl bg-surface-alt/70 px-6 py-3 text-center">
                    <p className="text-2xl font-black leading-none text-text-main">{job._count.applications}</p>
                    <p className="mt-1 text-xs font-bold text-text-muted">Applicants</p>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2 border-t border-surface-border pt-4">
                  <button
                    type="button"
                    onClick={() => onReviewApplicants(job.id, job.title)}
                    className="btn btn-primary btn-sm"
                  >
                    Review Applicants
                  </button>
                  <Link to={`/jobs/${job.id}`} className="btn btn-outline btn-sm bg-white">
                    View Role
                  </Link>
                  <button
                    type="button"
                    disabled={isUpdatingJobStatus}
                    onClick={() => void handleJobStatusUpdate(job.id, job.status === 'ACTIVE' ? 'CLOSED' : 'ACTIVE')}
                    className="btn btn-outline btn-sm bg-white disabled:opacity-60"
                  >
                    {job.status === 'ACTIVE' ? 'Close Role' : 'Reopen Role'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  )
}
