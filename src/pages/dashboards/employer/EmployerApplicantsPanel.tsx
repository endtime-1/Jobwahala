import { useState } from 'react'
import { Sparkles } from 'lucide-react'
import { Link } from 'react-router-dom'
import {
  apiUpdateApplicationStatus,
  apiCreateJobProposal,
  apiGenerateJobProposalDraft,
  apiGenerateJobShortlistSummary,
  apiGenerateJobApplicantComparison,
  apiGenerateApplicantDecisionBrief,
} from '../../../lib/api'
import { formatRelativeTime, getDisplayName } from '../../../lib/display'
import ProposalComposerModal from '../../../components/ProposalComposerModal'
import type {
  EmployerJob,
  JobApplicant,
  ApplicantDecisionBriefRecord,
  ProposalTarget,
  ProposalDraft,
} from './types'
import {
  applicationStatuses,
  getApplicationBadgeClass,
  getProposalBadgeClass,
  getFitScoreBadgeClass,
  getApplicantDecisionBadgeClass,
} from './utils'

type Props = {
  jobs: EmployerJob[]
  applicants: JobApplicant[]
  selectedJobId: string | null
  selectedJobTitle: string
  isApplicantsLoading: boolean
  onSelectJob: (jobId: string, jobTitle: string) => void
  onRefresh: () => void
}

export default function EmployerApplicantsPanel({
  jobs,
  applicants,
  selectedJobId,
  selectedJobTitle,
  isApplicantsLoading,
  onSelectJob,
  onRefresh,
}: Props) {
  const [isUpdatingApplication, setIsUpdatingApplication] = useState(false)
  const [isSubmittingProposal, setIsSubmittingProposal] = useState(false)
  const [isGeneratingProposalDraft, setIsGeneratingProposalDraft] = useState(false)
  const [isGeneratingShortlistSummary, setIsGeneratingShortlistSummary] = useState(false)
  const [isGeneratingApplicantComparison, setIsGeneratingApplicantComparison] = useState(false)
  const [shortlistSummaryFocus, setShortlistSummaryFocus] = useState('')
  const [shortlistSummary, setShortlistSummary] = useState('')
  const [shortlistSummaryJobId, setShortlistSummaryJobId] = useState<string | null>(null)
  const [shortlistSummaryCandidatesConsidered, setShortlistSummaryCandidatesConsidered] = useState(0)
  const [applicantComparisonSummary, setApplicantComparisonSummary] = useState('')
  const [applicantComparisonJobId, setApplicantComparisonJobId] = useState<string | null>(null)
  const [applicantComparisonCandidatesConsidered, setApplicantComparisonCandidatesConsidered] = useState(0)
  const [applicantDecisionBriefs, setApplicantDecisionBriefs] = useState<Record<string, ApplicantDecisionBriefRecord>>({})
  const [applicantDecisionErrors, setApplicantDecisionErrors] = useState<Record<string, string>>({})
  const [applicantDecisionLoadingId, setApplicantDecisionLoadingId] = useState<string | null>(null)
  const [proposalTarget, setProposalTarget] = useState<ProposalTarget | null>(null)
  const [error, setError] = useState('')

  const shortlistedCount = applicants.filter((a) => a.status === 'SHORTLISTED').length

  const handleApplicationStatusUpdate = async (applicationId: string, status: string) => {
    if (!selectedJobId) return
    setError('')
    setIsUpdatingApplication(true)
    try {
      await apiUpdateApplicationStatus(applicationId, status)
      onRefresh()
    } catch (err: any) {
      setError(err.message || 'Unable to update application status right now.')
    } finally {
      setIsUpdatingApplication(false)
    }
  }

  const handleGenerateShortlistSummary = async () => {
    if (!selectedJobId) return
    setError('')
    setIsGeneratingShortlistSummary(true)
    try {
      const focus = shortlistSummaryFocus.trim()
      const data = await apiGenerateJobShortlistSummary(selectedJobId, focus ? { focus } : {})
      setShortlistSummary(String(data.summary || ''))
      setShortlistSummaryJobId(selectedJobId)
      setShortlistSummaryCandidatesConsidered(Number(data.candidatesConsidered || 0))
    } catch (err: any) {
      setError(err.message || 'Unable to generate a shortlist brief right now.')
    } finally {
      setIsGeneratingShortlistSummary(false)
    }
  }

  const handleGenerateApplicantComparison = async () => {
    if (!selectedJobId) return
    setError('')
    setIsGeneratingApplicantComparison(true)
    try {
      const focus = shortlistSummaryFocus.trim()
      const data = await apiGenerateJobApplicantComparison(selectedJobId, focus ? { focus } : {})
      setApplicantComparisonSummary(String(data.summary || ''))
      setApplicantComparisonJobId(selectedJobId)
      setApplicantComparisonCandidatesConsidered(Number(data.candidatesConsidered || 0))
    } catch (err: any) {
      setError(err.message || 'Unable to generate an applicant comparison right now.')
    } finally {
      setIsGeneratingApplicantComparison(false)
    }
  }

  const handleGenerateApplicantDecisionBrief = async (applicationId: string) => {
    setApplicantDecisionErrors((c) => ({ ...c, [applicationId]: '' }))
    setApplicantDecisionLoadingId(applicationId)
    try {
      const focus = shortlistSummaryFocus.trim()
      const data = await apiGenerateApplicantDecisionBrief(applicationId, focus ? { focus } : {})
      const brief = (data.brief || null) as ApplicantDecisionBriefRecord | null
      if (!brief) throw new Error('Decision brief response was empty.')
      setApplicantDecisionBriefs((c) => ({ ...c, [applicationId]: brief }))
    } catch (err: any) {
      setApplicantDecisionErrors((c) => ({ ...c, [applicationId]: err.message || 'Unable to generate an applicant brief right now.' }))
    } finally {
      setApplicantDecisionLoadingId((c) => (c === applicationId ? null : c))
    }
  }

  const handleCreateProposal = async (draft: ProposalDraft) => {
    if (!proposalTarget) return
    setError('')
    setIsSubmittingProposal(true)
    try {
      await apiCreateJobProposal(proposalTarget.applicationId, {
        title: draft.title,
        summary: draft.summary,
        amount: draft.amount || undefined,
        timeline: draft.timeline || undefined,
        expiresAt: draft.expiresAt || undefined,
        message: draft.message || undefined,
      })
      setProposalTarget(null)
      onRefresh()
    } catch (err: any) {
      setError(err.message || 'Unable to send this proposal right now.')
    } finally {
      setIsSubmittingProposal(false)
    }
  }

  const handleGenerateProposalDraft = async (draft: ProposalDraft) => {
    if (!proposalTarget) return undefined
    setIsGeneratingProposalDraft(true)
    try {
      const data = await apiGenerateJobProposalDraft(proposalTarget.applicationId, {
        title: draft.title || undefined,
        amount: draft.amount || undefined,
        timeline: draft.timeline || undefined,
        focus: draft.message || draft.summary || undefined,
      })
      return data.draft as Partial<ProposalDraft>
    } catch (err: any) {
      throw new Error(err.message || 'Unable to generate a proposal draft right now.')
    } finally {
      setIsGeneratingProposalDraft(false)
    }
  }

  return (
    <>
      <section className="dashboard-panel p-5 sm:p-7 lg:p-8">
        <div className="flex flex-col gap-4 border-b border-surface-border/50 pb-6 mb-10 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="font-black text-xs uppercase tracking-[0.2em] text-text-main">Applicant Review</h2>
            <p className="mt-2 text-sm font-semibold text-text-muted">
              {selectedJobTitle ? `Managing candidates for ${selectedJobTitle}.` : 'Select a job to review candidates.'}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="badge bg-accent text-white border-none text-[9px] uppercase tracking-widest">
              {shortlistedCount} shortlisted
            </span>
            <span className="badge bg-secondary text-white border-none text-[9px] uppercase tracking-widest">
              {applicants.length} loaded
            </span>
            <button
              type="button"
              disabled={!selectedJobId || applicants.length === 0 || isApplicantsLoading || isGeneratingShortlistSummary}
              onClick={() => void handleGenerateShortlistSummary()}
              className="btn btn-outline btn-sm border-primary/15 bg-white text-[10px] font-black uppercase tracking-widest text-primary hover:bg-primary/5 disabled:opacity-60"
            >
              <Sparkles className="h-4 w-4" /> {isGeneratingShortlistSummary ? 'Generating...' : 'Generate Shortlist Brief'}
            </button>
            <button
              type="button"
              disabled={!selectedJobId || applicants.length === 0 || isApplicantsLoading || isGeneratingApplicantComparison}
              onClick={() => void handleGenerateApplicantComparison()}
              className="btn btn-outline btn-sm border-primary/15 bg-white text-[10px] font-black uppercase tracking-widest text-primary hover:bg-primary/5 disabled:opacity-60"
            >
              <Sparkles className="h-4 w-4" /> {isGeneratingApplicantComparison ? 'Generating...' : 'Compare Applicants'}
            </button>
          </div>
        </div>

        {error ? (
          <div className="mb-6 rounded-2xl border border-error/10 bg-error/5 px-4 py-3 text-sm font-semibold text-error">{error}</div>
        ) : null}

        {jobs.length > 0 ? (
          <div className="flex flex-wrap gap-3 mb-8">
            {jobs.map((job) => (
              <button
                key={job.id}
                type="button"
                onClick={() => onSelectJob(job.id, job.title)}
                className={`rounded-2xl px-5 py-3 text-[10px] font-black uppercase tracking-[0.2em] transition-all ${
                  selectedJobId === job.id
                    ? 'bg-primary text-white'
                    : 'bg-surface-alt/30 border border-surface-border text-text-muted hover:border-primary hover:text-primary'
                }`}
              >
                {job.title} ({job._count.applications})
              </button>
            ))}
          </div>
        ) : null}

        {!selectedJobId ? (
          <p className="text-sm font-semibold text-text-light">No job selected for review yet.</p>
        ) : isApplicantsLoading ? (
          <p className="text-sm font-semibold text-text-light">Loading applicants...</p>
        ) : applicants.length === 0 ? (
          <div className="rounded-[1.75rem] border border-dashed border-surface-border bg-surface-alt/10 p-6 sm:p-8">
            <p className="text-sm font-semibold text-text-light">No applicants have applied to this role yet.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* AI Brief Focus + Summaries */}
            <div className="rounded-[1.75rem] border border-primary/10 bg-white/80 p-4 sm:p-5 shadow-premium-sm">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div className="flex-1">
                  <label htmlFor="shortlist-focus" className="text-[10px] font-black uppercase tracking-[0.2em] text-text-light">
                    Focus brief on
                  </label>
                  <textarea
                    id="shortlist-focus"
                    value={shortlistSummaryFocus}
                    onChange={(e) => setShortlistSummaryFocus(e.target.value)}
                    rows={2}
                    placeholder="Optional: highlight leadership, React depth, remote readiness, salary alignment..."
                    className="input input-bordered mt-3 min-h-[5rem] w-full resize-y border-primary/10 bg-surface-alt/10 text-sm font-medium leading-relaxed"
                  />
                </div>
                <div className="lg:w-[18rem]">
                  <p className="text-[11px] font-semibold leading-relaxed text-text-muted">
                    Generate a decision-ready summary across fit score, cover letter signal, and stage readiness for the active role.
                  </p>
                </div>
              </div>
              {shortlistSummary && shortlistSummaryJobId === selectedJobId ? (
                <div className="mt-5 rounded-[1.5rem] border border-primary/10 bg-primary/5 p-4 sm:p-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">AI Shortlist Brief</p>
                      <p className="mt-1 text-sm font-semibold text-text-muted">
                        Built from {shortlistSummaryCandidatesConsidered} ranked candidate{shortlistSummaryCandidatesConsidered === 1 ? '' : 's'}.
                      </p>
                    </div>
                    <span className="badge bg-primary text-white border-none text-[9px] uppercase tracking-widest">
                      {selectedJobTitle || 'Active role'}
                    </span>
                  </div>
                  <p className="mt-4 whitespace-pre-wrap text-sm font-medium leading-relaxed text-text-main">
                    {shortlistSummary}
                  </p>
                </div>
              ) : null}
              {applicantComparisonSummary && applicantComparisonJobId === selectedJobId ? (
                <div className="mt-5 rounded-[1.5rem] border border-secondary/10 bg-secondary/5 p-4 sm:p-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-secondary">AI Applicant Comparison</p>
                      <p className="mt-1 text-sm font-semibold text-text-muted">
                        Built from the top {applicantComparisonCandidatesConsidered} ranked candidate{applicantComparisonCandidatesConsidered === 1 ? '' : 's'}.
                      </p>
                    </div>
                    <span className="badge bg-secondary text-white border-none text-[9px] uppercase tracking-widest">
                      {selectedJobTitle || 'Active role'}
                    </span>
                  </div>
                  <p className="mt-4 whitespace-pre-wrap text-sm font-medium leading-relaxed text-text-main">
                    {applicantComparisonSummary}
                  </p>
                </div>
              ) : null}
            </div>

            {/* Applicant cards */}
            {applicants.map((application) => {
              const name = getDisplayName(
                application.seeker.jobSeekerProfile?.firstName,
                application.seeker.jobSeekerProfile?.lastName,
                application.seeker.email,
              )

              return (
                <div key={application.id} className="rounded-[1.75rem] border border-surface-border bg-surface-alt/20 p-4 sm:p-6">
                  <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
                    <div className="flex gap-4">
                      <div className="h-12 w-12 bg-white border border-surface-border rounded-2xl flex items-center justify-center text-[10px] font-black text-text-main shadow-sm">
                        {name.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-lg font-black text-text-main">{name}</p>
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-text-light mt-1">
                          Applied {formatRelativeTime(application.createdAt)}
                        </p>
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          {application.fitScore ? (
                            <span className={`badge border-none text-[9px] uppercase tracking-widest ${getFitScoreBadgeClass(application.fitScore)}`}>
                              {application.fitScore}% fit
                            </span>
                          ) : null}
                          {application.fitReasons?.slice(0, 2).map((reason) => (
                            <span key={`${application.id}-${reason}`} className="rounded-full border border-primary/10 bg-primary/5 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-primary">
                              {reason}
                            </span>
                          ))}
                        </div>
                        {application.seeker.jobSeekerProfile?.skills ? (
                          <p className="mt-3 text-sm font-semibold text-text-muted">
                            Skills: {application.seeker.jobSeekerProfile.skills}
                          </p>
                        ) : null}
                        <div className="mt-4 rounded-2xl bg-white border border-surface-border p-4">
                          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-text-light mb-2">Cover Letter</p>
                          <p className="text-sm text-text-main leading-relaxed whitespace-pre-wrap">
                            {application.coverLetter?.trim() || 'No cover letter was provided for this application.'}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="lg:w-[280px] space-y-4">
                      <div className="flex justify-between items-center">
                        <span className={`badge ${getApplicationBadgeClass(application.status)}`}>{application.status}</span>
                        <div className="flex items-center gap-3">
                          {application.agreement ? (
                            <Link to="/agreements" className="text-[10px] font-black uppercase tracking-widest text-primary hover:underline">Agreement</Link>
                          ) : null}
                          <Link
                            to={`/messaging?userId=${application.seeker.id}&email=${encodeURIComponent(application.seeker.email)}`}
                            className="text-[10px] font-black uppercase tracking-widest text-primary hover:underline"
                          >
                            Message
                          </Link>
                          {application.proposals?.[0] ? (
                            <Link to="/proposals" className="text-[10px] font-black uppercase tracking-widest text-primary hover:underline">Manage Proposal</Link>
                          ) : null}
                          <button
                            type="button"
                            onClick={() => void handleGenerateApplicantDecisionBrief(application.id)}
                            disabled={applicantDecisionLoadingId === application.id}
                            className="text-[10px] font-black uppercase tracking-widest text-secondary hover:text-primary disabled:opacity-40"
                          >
                            {applicantDecisionLoadingId === application.id ? 'Loading...' : 'AI Decision'}
                          </button>
                        </div>
                      </div>

                      {application.proposals?.[0] ? (
                        <div className="rounded-2xl border border-primary/10 bg-primary/5 px-4 py-4">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">Active Proposal</p>
                              <p className="mt-1 text-sm font-black text-text-main">{application.proposals[0].title}</p>
                            </div>
                            <span className={`badge ${getProposalBadgeClass(application.proposals[0].status)}`}>
                              {application.proposals[0].status}
                            </span>
                          </div>
                          <p className="mt-2 text-[11px] font-medium leading-relaxed text-text-muted">
                            Updated {formatRelativeTime(application.proposals[0].updatedAt)}
                          </p>
                        </div>
                      ) : ['SUBMITTED', 'SHORTLISTED', 'INTERVIEW'].includes(application.status) && !application.agreement ? (
                        <button
                          type="button"
                          onClick={() =>
                            setProposalTarget({
                              applicationId: application.id,
                              jobTitle: selectedJobTitle || 'this role',
                              applicantName: name,
                              suggestedAmount: '',
                            })
                          }
                          className="btn btn-outline btn-sm w-full justify-center border-primary/15 bg-white text-[10px] font-black uppercase tracking-widest text-primary hover:bg-primary/5"
                        >
                          Send Proposal
                        </button>
                      ) : null}

                      {applicantDecisionErrors[application.id] ? (
                        <div className="rounded-2xl border border-error/10 bg-error/5 px-4 py-4">
                          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-error">Applicant Decision Brief</p>
                          <p className="mt-2 text-sm font-semibold text-error">{applicantDecisionErrors[application.id]}</p>
                        </div>
                      ) : applicantDecisionBriefs[application.id] ? (
                        <div className="rounded-2xl border border-secondary/10 bg-secondary/5 px-4 py-4">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-secondary">AI Applicant Decision</p>
                              <p className="mt-1 text-sm font-black text-text-main">{applicantDecisionBriefs[application.id].headline}</p>
                            </div>
                            <span className={`badge ${getApplicantDecisionBadgeClass(applicantDecisionBriefs[application.id].recommendation)}`}>
                              {applicantDecisionBriefs[application.id].recommendation}
                            </span>
                          </div>
                          <p className="mt-3 text-sm font-medium leading-relaxed text-text-main">{applicantDecisionBriefs[application.id].summary}</p>
                          <div className="mt-4 rounded-2xl border border-surface-border bg-white/80 px-4 py-3">
                            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-primary">Next action</p>
                            <p className="mt-2 text-sm font-semibold leading-6 text-text-main">{applicantDecisionBriefs[application.id].nextAction}</p>
                          </div>
                          <p className="mt-3 text-xs font-medium italic leading-6 text-text-muted">{applicantDecisionBriefs[application.id].suggestedMessage}</p>
                        </div>
                      ) : null}

                      <div className="grid grid-cols-2 gap-3">
                        {applicationStatuses.map((status) => (
                          <button
                            key={status}
                            type="button"
                            disabled={isUpdatingApplication || application.status === status}
                            onClick={() => void handleApplicationStatusUpdate(application.id, status)}
                            className={`rounded-xl px-3 py-3 text-[10px] font-black uppercase tracking-[0.2em] transition-all ${
                              application.status === status
                                ? 'bg-primary text-white'
                                : 'bg-white border border-surface-border text-text-muted hover:border-primary hover:text-primary'
                            } disabled:opacity-60`}
                          >
                            {status}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      <ProposalComposerModal
        isOpen={Boolean(proposalTarget)}
        heading={proposalTarget ? `Send proposal to ${proposalTarget.applicantName}` : 'Send proposal'}
        subtitle={
          proposalTarget
            ? `Use proposal terms to move ${proposalTarget.applicantName} from ${proposalTarget.jobTitle} into a live agreement.`
            : ''
        }
        defaultValue={
          proposalTarget
            ? { title: `${proposalTarget.jobTitle} proposal`, amount: proposalTarget.suggestedAmount || '' }
            : undefined
        }
        isSubmitting={isSubmittingProposal}
        isGenerating={isGeneratingProposalDraft}
        error={error}
        submitLabel="Send Proposal"
        onGenerate={handleGenerateProposalDraft}
        onClose={() => setProposalTarget(null)}
        onSubmit={handleCreateProposal}
      />
    </>
  )
}
