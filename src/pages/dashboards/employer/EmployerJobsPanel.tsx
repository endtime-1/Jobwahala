import { useState } from 'react'
import { ChevronRight, Clock, Sparkles } from 'lucide-react'
import { Link } from 'react-router-dom'
import { apiCreateJob, apiGenerateJobDraft, apiUpdateJobStatus } from '../../../lib/api'
import { emailHandle, formatRelativeTime } from '../../../lib/display'
import type { EmployerJob, JobCopilotDraft } from './types'
import { initialJobForm } from './utils'

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
    } catch (err: any) {
      setError(err.message || 'Unable to create job right now.')
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
    } catch (err: any) {
      setError(err.message || 'Unable to generate a job draft right now.')
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
    } catch (err: any) {
      setError(err.message || 'Unable to update this job status right now.')
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
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">Live API</span>
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
          <div className="space-y-6">
            {jobs.map((job) => (
              <div
                key={job.id}
                className="rounded-[1.75rem] border border-transparent bg-surface-alt/20 p-5 transition-all hover:border-surface-border hover:bg-white sm:p-8"
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-8">
                  <div className="flex gap-6 items-center">
                    <div className="h-16 w-16 bg-white border border-surface-border/50 rounded-2xl flex items-center justify-center text-text-main font-black text-sm shadow-sm">
                      JOB
                    </div>
                    <div>
                      <h3 className="font-black text-xl text-text-main tracking-tighter mb-2 leading-none">{job.title}</h3>
                      <div className="flex items-center gap-4">
                        <span className="badge bg-primary text-white text-[9px] uppercase tracking-widest">{job.status}</span>
                        {job.postedByAdmin ? (
                          <span className="badge bg-secondary text-white text-[9px] uppercase tracking-widest">
                            Admin Assisted
                          </span>
                        ) : null}
                        <span className="text-[10px] font-black text-text-light uppercase tracking-widest flex items-center gap-2">
                          <Clock className="h-3.5 w-3.5" /> {formatRelativeTime(job.createdAt)}
                        </span>
                      </div>
                      {job.postedByAdmin ? (
                        <p className="mt-3 text-[10px] font-black uppercase tracking-[0.2em] text-text-light">
                          Posted by JobWahala admin / {emailHandle(job.postedByAdmin.email)}
                        </p>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex flex-col md:flex-row items-stretch md:items-center gap-4">
                    <div className="flex items-center gap-10 px-8 py-4 bg-white rounded-2xl shadow-sm border border-surface-border/50">
                      <div className="text-center">
                        <p className="text-lg font-black text-text-main leading-none mb-1">{job._count.applications}</p>
                        <p className="text-[9px] font-black text-text-light uppercase tracking-widest">Applicants</p>
                      </div>
                      <div className="h-10 w-px bg-surface-border"></div>
                      <div className="text-center">
                        <p className="text-lg font-black text-success leading-none mb-1">{job.status}</p>
                        <p className="text-[9px] font-black text-text-light uppercase tracking-widest">Status</p>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <button
                        type="button"
                        disabled={isUpdatingJobStatus}
                        onClick={() => void handleJobStatusUpdate(job.id, job.status === 'ACTIVE' ? 'CLOSED' : 'ACTIVE')}
                        className="btn btn-outline btn-sm bg-white font-black uppercase tracking-widest text-[10px] disabled:opacity-60"
                      >
                        {job.status === 'ACTIVE' ? 'Close Role' : 'Reopen Role'}
                      </button>
                      <Link to={`/jobs/${job.id}`} className="btn btn-outline btn-sm bg-white font-black uppercase tracking-widest text-[10px]">
                        View Role
                      </Link>
                      <button
                        type="button"
                        onClick={() => onReviewApplicants(job.id, job.title)}
                        className="btn btn-primary btn-sm font-black uppercase tracking-widest text-[10px]"
                      >
                        Review Applicants
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  )
}
