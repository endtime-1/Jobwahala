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
        <form onSubmit={handleCreateJob} className="dashboard-panel p-5 sm:p-7 lg:p-8 space-y-6">
          <div className="flex justify-between items-center pb-6 border-b border-surface-border/50">
            <h2 className="font-black text-xs uppercase tracking-[0.2em] text-text-main">Create Job Posting</h2>
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">Goes live instantly</span>
          </div>
          <div className="rounded-[28px] border border-primary/15 bg-primary/5 p-5 sm:p-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.24em] text-primary">
                  <Sparkles className="h-4 w-4" /> Hiring Copilot
                </p>
                <h3 className="mt-3 text-lg font-black text-text-main">
                  Generate a sharper role summary, clearer positioning, and stronger hiring signal.
                </h3>
                <p className="mt-2 max-w-2xl text-sm font-medium leading-relaxed text-text-muted">
                  Use your company profile and current inputs to draft a tighter job post before you publish.
                </p>
              </div>
              <button
                type="button"
                onClick={handleGenerateJobDraft}
                disabled={isGeneratingJobDraft}
                className="btn btn-secondary btn-sm rounded-2xl px-5 text-[10px] font-black uppercase tracking-widest disabled:opacity-60"
              >
                {isGeneratingJobDraft ? 'Generating...' : 'Generate AI Job Draft'}
              </button>
            </div>
            {jobCopilotDraft ? (
              <div className="mt-5 grid gap-3 md:grid-cols-2">
                <div className="rounded-2xl border border-surface-border bg-white/80 p-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.22em] text-text-light">Positioning</p>
                  <p className="mt-2 text-sm font-semibold leading-relaxed text-text-main">
                    {jobCopilotDraft.positioning || 'No positioning note yet.'}
                  </p>
                </div>
                <div className="rounded-2xl border border-surface-border bg-white/80 p-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.22em] text-text-light">Hiring note</p>
                  <p className="mt-2 text-sm font-semibold leading-relaxed text-text-main">
                    {jobCopilotDraft.hiringNote || 'No hiring note yet.'}
                  </p>
                </div>
              </div>
            ) : null}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <input type="text" placeholder="Job title" value={jobForm.title} onChange={(e) => setJobForm((c) => ({ ...c, title: e.target.value }))} className="h-14 font-bold" required />
            <input type="text" placeholder="Location or work mode (Remote, Hybrid, Accra)" value={jobForm.location} onChange={(e) => setJobForm((c) => ({ ...c, location: e.target.value }))} className="h-14 font-bold" />
            <select value={jobForm.type} onChange={(e) => setJobForm((c) => ({ ...c, type: e.target.value }))} className="h-14 font-bold">
              <option>Full-time</option>
              <option>Part-time</option>
              <option>Contract</option>
              <option>Freelance</option>
            </select>
            <input type="text" placeholder="Salary" value={jobForm.salary} onChange={(e) => setJobForm((c) => ({ ...c, salary: e.target.value }))} className="h-14 font-bold" />
            <input type="text" placeholder="Category" value={jobForm.category} onChange={(e) => setJobForm((c) => ({ ...c, category: e.target.value }))} className="h-14 font-bold md:col-span-2" />
          </div>
          <textarea
            placeholder="Describe the role, responsibilities, and expectations..."
            value={jobForm.description}
            onChange={(e) => setJobForm((c) => ({ ...c, description: e.target.value }))}
            className="min-h-[180px] font-bold py-4"
            required
          />
          <div className="flex justify-end">
            <button type="submit" disabled={isCreatingJob} className="btn btn-primary btn-lg px-8 rounded-2xl font-black uppercase tracking-widest disabled:opacity-60">
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
          <p className="text-sm font-semibold text-text-light">No jobs posted yet.</p>
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
