import { useEffect, useMemo, useState } from 'react'
import { ShieldCheck, PlusCircle, Users, Handshake } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { apiCreateVerificationRequest } from '../../lib/api'
import { subscribeToRealtimeEvents } from '../../lib/realtime'
import VerifiedBadge from '../../components/VerifiedBadge'
import VerificationPanel from '../../components/VerificationPanel'

import { useEmployerDashboard, useJobApplicants } from './employer/hooks'
import EmployerStatsCards from './employer/EmployerStatsCards'
import EmployerJobsPanel from './employer/EmployerJobsPanel'
import EmployerApplicantsPanel from './employer/EmployerApplicantsPanel'
import EmployerSidebar from './employer/EmployerSidebar'
import EmployerServiceRequests from './employer/EmployerServiceRequests'

export default function EmployerDashboard() {
  const queryClient = useQueryClient()
  const { data, isLoading, error: dashboardError } = useEmployerDashboard()
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null)
  const [selectedJobTitle, setSelectedJobTitle] = useState('')
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [isSubmittingVerification, setIsSubmittingVerification] = useState(false)
  const [error, setError] = useState('')

  const jobs = data?.jobs ?? []
  const recentApplications = data?.recentApplications ?? []
  const sentRequests = data?.sentRequests ?? []
  const unreadMessages = data?.unreadMessages ?? 0
  const activeAgreementCount = data?.activeAgreementCount ?? 0
  const upcomingMilestones = data?.upcomingMilestones ?? []
  const pendingProposalActions = data?.pendingProposalActions ?? 0
  const proposalActionItems = data?.proposalActionItems ?? []
  const pendingReviewActions = data?.pendingReviewActions ?? 0
  const reviewActionItems = data?.reviewActionItems ?? []
  const pendingDisputeActions = data?.pendingDisputeActions ?? 0
  const disputeActionItems = data?.disputeActionItems ?? []
  const pendingPaymentActions = data?.pendingPaymentActions ?? 0
  const paymentActionItems = data?.paymentActionItems ?? []
  const verification = data?.verification ?? null

  const { data: applicants = [], isLoading: isApplicantsLoading } = useJobApplicants(selectedJobId)

  const totalApplicants = useMemo(() => jobs.reduce((sum, job) => sum + job._count.applications, 0), [jobs])
  const shortlistedCount = useMemo(() => applicants.filter((a) => a.status === 'SHORTLISTED').length, [applicants])

  // Auto-select first job with applicants
  useEffect(() => {
    if (jobs.length > 0 && !selectedJobId) {
      const preferred = jobs.find((job) => job._count.applications > 0) || jobs[0]
      setSelectedJobId(preferred.id)
      setSelectedJobTitle(preferred.title)
    }
  }, [jobs, selectedJobId])

  // SSE realtime
  useEffect(() => {
    return subscribeToRealtimeEvents({
      onMessagesRefresh: () => void queryClient.invalidateQueries({ queryKey: ['employer'] }),
      onProposalsRefresh: () => void queryClient.invalidateQueries({ queryKey: ['employer'] }),
      onAgreementsRefresh: () => void queryClient.invalidateQueries({ queryKey: ['employer'] }),
    })
  }, [queryClient])

  const refreshDashboard = () => {
    void queryClient.invalidateQueries({ queryKey: ['employer'] })
  }

  const handleSelectJob = (jobId: string, jobTitle: string) => {
    setSelectedJobId(jobId)
    setSelectedJobTitle(jobTitle)
  }

  const handleSubmitVerification = async (payload: { details: string; documentUrl?: string }) => {
    setError('')
    setIsSubmittingVerification(true)
    try {
      await apiCreateVerificationRequest(payload)
      refreshDashboard()
    } catch (err: any) {
      setError(err.message || 'Unable to submit your verification request right now.')
    } finally {
      setIsSubmittingVerification(false)
    }
  }

  return (
    <div className="fade-in">
      <header className="dashboard-hero mb-8 px-5 py-6 sm:px-7 sm:py-7 lg:px-8 lg:py-8">
        <div className="relative z-10 flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <div className="dashboard-kicker mb-4">
              <ShieldCheck className="h-3.5 w-3.5" /> Employer command center
            </div>
            <div className="mb-3 flex items-center gap-4">
              <h1 className="text-4xl font-black leading-tight tracking-tighter text-text-main md:text-5xl">
                Recruitment <span className="text-primary italic">Hub</span>
              </h1>
              <VerifiedBadge type="employer" />
            </div>
            <p className="text-base font-medium tracking-tight text-text-muted md:text-lg">
              Live employer dashboard powered by your jobs, applicants, and hiring decisions.
            </p>
            <div className="dashboard-actions">
              <button type="button" onClick={() => setShowCreateForm((c) => !c)} className="dashboard-action-chip">
                <PlusCircle className="h-4 w-4" /> {showCreateForm ? 'Close form' : 'Post New Role'}
              </button>
              <Link to="/freelancers" className="dashboard-action-chip">
                <Users className="h-4 w-4" /> Find talent
              </Link>
              <Link to="/agreements" className="dashboard-action-chip">
                <Handshake className="h-4 w-4" /> Agreements
              </Link>
              <Link to="/proposals" className="dashboard-action-chip">
                <Handshake className="h-4 w-4" /> Proposals
              </Link>
            </div>
          </div>
          <div className="dashboard-panel px-5 py-5 sm:min-w-[20rem] sm:px-6">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-text-light">Hiring snapshot</p>
            <div className="mt-4 grid grid-cols-3 gap-3">
              <div className="rounded-2xl bg-white/80 px-3 py-4 text-center shadow-premium-sm">
                <p className="text-2xl font-black text-text-main">{jobs.length}</p>
                <p className="mt-1 text-[9px] font-black uppercase tracking-[0.18em] text-text-light">Roles</p>
              </div>
              <div className="rounded-2xl bg-white/80 px-3 py-4 text-center shadow-premium-sm">
                <p className="text-2xl font-black text-text-main">{totalApplicants}</p>
                <p className="mt-1 text-[9px] font-black uppercase tracking-[0.18em] text-text-light">Applicants</p>
              </div>
              <div className="rounded-2xl bg-white/80 px-3 py-4 text-center shadow-premium-sm">
                <p className="text-2xl font-black text-text-main">{pendingPaymentActions}</p>
                <p className="mt-1 text-[9px] font-black uppercase tracking-[0.18em] text-text-light">Payouts</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {(error || dashboardError) ? (
        <div className="mb-8 rounded-2xl border border-error/10 bg-error/5 px-4 py-3 text-sm font-semibold text-error">
          {error || (dashboardError instanceof Error ? dashboardError.message : 'Unable to load your employer dashboard right now.')}
        </div>
      ) : null}

      <EmployerStatsCards
        jobCount={jobs.length}
        totalApplicants={totalApplicants}
        unreadMessages={unreadMessages}
        pendingPaymentActions={pendingPaymentActions}
      />

      {isLoading ? (
        <div className="card bg-white border-surface-border p-10">
          <p className="text-sm font-black uppercase tracking-[0.2em] text-text-light">Loading employer dashboard...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.65fr)_minmax(20rem,0.95fr)]">
          <section className="space-y-6">
            <EmployerJobsPanel
              jobs={jobs}
              showCreateForm={showCreateForm}
              onToggleCreateForm={() => setShowCreateForm(false)}
              onJobCreated={refreshDashboard}
              onReviewApplicants={handleSelectJob}
            />

            <EmployerApplicantsPanel
              jobs={jobs}
              applicants={applicants}
              selectedJobId={selectedJobId}
              selectedJobTitle={selectedJobTitle}
              isApplicantsLoading={isApplicantsLoading}
              onSelectJob={handleSelectJob}
              onRefresh={refreshDashboard}
            />
          </section>

          <div className="space-y-6">
            <EmployerSidebar
              jobs={jobs}
              recentApplications={recentApplications}
              unreadMessages={unreadMessages}
              shortlistedCount={shortlistedCount}
              totalApplicants={totalApplicants}
              activeAgreementCount={activeAgreementCount}
              upcomingMilestones={upcomingMilestones}
              pendingProposalActions={pendingProposalActions}
              proposalActionItems={proposalActionItems}
              pendingReviewActions={pendingReviewActions}
              reviewActionItems={reviewActionItems}
              pendingDisputeActions={pendingDisputeActions}
              disputeActionItems={disputeActionItems}
              pendingPaymentActions={pendingPaymentActions}
              paymentActionItems={paymentActionItems}
              onReviewApplicants={handleSelectJob}
            />

            <VerificationPanel
              type="employer"
              verification={verification}
              isSubmitting={isSubmittingVerification}
              onSubmit={handleSubmitVerification}
            />

            <EmployerServiceRequests sentRequests={sentRequests} onRefresh={refreshDashboard} />
          </div>
        </div>
      )}
    </div>
  )
}
