import { useEffect, useMemo, useState } from 'react'
import { Star, Briefcase, Award, ChevronRight, ShieldCheck, UserCheck, MessageSquare, PlusCircle, Pencil, Trash2, Handshake, Sparkles } from 'lucide-react'
import VerifiedBadge from '../../components/VerifiedBadge'
import VerificationPanel from '../../components/VerificationPanel'
import { Link } from 'react-router-dom'
import ProposalComposerModal, { type ProposalDraft } from '../../components/ProposalComposerModal'
import { useQueryClient } from '@tanstack/react-query'
import { apiCreateService, apiCreateServiceProposal, apiCreateVerificationRequest, apiDeleteService, apiGenerateServiceDraft, apiGenerateServiceProposalDraft, apiUpdateOwnedServiceStatus, apiUpdateService, apiUpdateServiceRequestStatus } from '../../lib/api'
import { emailHandle, formatMoney, formatRelativeTime, getDisplayName } from '../../lib/display'
import { useAuth } from '../../context/AuthContext'
import { subscribeToRealtimeEvents } from '../../lib/realtime'
import WorkflowSidebar from './shared/WorkflowSidebar'
import { getApplicationBadgeClass, getRequestBadgeClass, getProposalBadgeClass } from './shared/utils'
import { useFreelancerDashboard } from './freelancer/hooks'
import type { ProposalTarget, ServiceCopilotDraft } from './freelancer/hooks'

const initialServiceForm = { title: '', description: '', price: '', deliveryTime: '', category: '' }
const requestStatuses = ['PENDING', 'ACCEPTED', 'DECLINED', 'COMPLETED']

export default function FreelancerDashboard() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const { data, isLoading, error: dashboardError } = useFreelancerDashboard()

  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSubmittingProposal, setIsSubmittingProposal] = useState(false)
  const [isGeneratingProposalDraft, setIsGeneratingProposalDraft] = useState(false)
  const [isGeneratingServiceDraft, setIsGeneratingServiceDraft] = useState(false)
  const [isUpdatingRequest, setIsUpdatingRequest] = useState(false)
  const [isUpdatingServiceStatus, setIsUpdatingServiceStatus] = useState(false)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [editingServiceId, setEditingServiceId] = useState<string | null>(null)
  const [serviceForm, setServiceForm] = useState(initialServiceForm)
  const [proposalTarget, setProposalTarget] = useState<ProposalTarget | null>(null)
  const [serviceCopilotDraft, setServiceCopilotDraft] = useState<ServiceCopilotDraft | null>(null)

  const services = data?.services ?? []
  const recentMessages = data?.recentMessages ?? []
  const requests = data?.requests ?? []
  const unreadMessages = data?.unreadMessages ?? 0

  const refreshDashboard = () => void queryClient.invalidateQueries({ queryKey: ['freelancer'] })

  useEffect(() => {
    if (!user) return
    return subscribeToRealtimeEvents({
      onMessagesRefresh: refreshDashboard,
      onProposalsRefresh: refreshDashboard,
      onAgreementsRefresh: refreshDashboard,
    })
  }, [user?.id])

  const profileStrength = useMemo(() => {
    const fields = [user?.freelancerProfile?.firstName, user?.freelancerProfile?.lastName, user?.freelancerProfile?.bio, user?.freelancerProfile?.skills, user?.freelancerProfile?.hourlyRate, user?.freelancerProfile?.portfolioUrl]
    return Math.max(20, Math.round((fields.filter(Boolean).length / fields.length) * 100))
  }, [user])

  const isEditing = Boolean(editingServiceId)
  const pendingRequests = useMemo(() => requests.filter((r) => r.status === 'PENDING').length, [requests])

  const resetForm = () => { setServiceForm(initialServiceForm); setEditingServiceId(null); setShowCreateForm(false); setServiceCopilotDraft(null) }

  const handleCreateService = async (event: React.FormEvent) => {
    event.preventDefault(); setError(''); setIsSubmitting(true)
    try { await apiCreateService(serviceForm); resetForm(); refreshDashboard() } catch (err: any) { setError(err.message || 'Unable to publish.') } finally { setIsSubmitting(false) }
  }

  const handleUpdateService = async (event: React.FormEvent) => {
    event.preventDefault(); if (!editingServiceId) return; setError(''); setIsSubmitting(true)
    try { await apiUpdateService(editingServiceId, serviceForm); resetForm(); refreshDashboard() } catch (err: any) { setError(err.message || 'Unable to update.') } finally { setIsSubmitting(false) }
  }

  const handleDeleteService = async (serviceId: string) => {
    if (!window.confirm('Delete this service?')) return; setError(''); setIsSubmitting(true)
    try { await apiDeleteService(serviceId); if (editingServiceId === serviceId) resetForm(); refreshDashboard() } catch (err: any) { setError(err.message || 'Unable to delete.') } finally { setIsSubmitting(false) }
  }

  const startEditing = (service: { id: string; title: string; description: string; price: number; deliveryTime?: string | null; category?: string | null }) => {
    setEditingServiceId(service.id); setShowCreateForm(false); setServiceCopilotDraft(null)
    setServiceForm({ title: service.title, description: service.description, price: String(service.price), deliveryTime: service.deliveryTime || '', category: service.category || '' })
  }

  const handleGenerateServiceDraft = async () => {
    setError(''); setIsGeneratingServiceDraft(true)
    try {
      const data = await apiGenerateServiceDraft({ ...serviceForm, focus: serviceForm.description || undefined })
      const draft = (data.draft || {}) as Partial<typeof serviceForm> & ServiceCopilotDraft
      setServiceForm((c) => ({ ...c, title: draft.title || c.title, description: draft.description || c.description, price: draft.price || c.price, deliveryTime: draft.deliveryTime || c.deliveryTime, category: draft.category || c.category }))
      setServiceCopilotDraft({ positioning: draft.positioning || '', pricingNote: draft.pricingNote || '' })
    } catch (err: any) { setError(err.message || 'Unable to generate draft.') } finally { setIsGeneratingServiceDraft(false) }
  }

  const handleRequestStatusUpdate = async (requestId: string, status: string) => {
    setError(''); setIsUpdatingRequest(true)
    try { await apiUpdateServiceRequestStatus(requestId, status); refreshDashboard() } catch (err: any) { setError(err.message || 'Unable to update.') } finally { setIsUpdatingRequest(false) }
  }

  const handleServiceStatusUpdate = async (serviceId: string, status: string) => {
    setError(''); setIsUpdatingServiceStatus(true)
    try { await apiUpdateOwnedServiceStatus(serviceId, status); if (editingServiceId === serviceId) resetForm(); refreshDashboard() } catch (err: any) { setError(err.message || 'Unable to update.') } finally { setIsUpdatingServiceStatus(false) }
  }

  const handleSubmitVerification = async (payload: { details: string; documentUrl?: string }) => {
    setError(''); setIsUpdatingServiceStatus(true)
    try { await apiCreateVerificationRequest(payload); refreshDashboard() } catch (err: any) { setError(err.message || 'Unable to submit.') } finally { setIsUpdatingServiceStatus(false) }
  }

  const handleCreateProposal = async (draft: ProposalDraft) => {
    if (!proposalTarget) return; setError(''); setIsSubmittingProposal(true)
    try {
      await apiCreateServiceProposal(proposalTarget.requestId, { title: draft.title, summary: draft.summary, amount: draft.amount || undefined, timeline: draft.timeline || undefined, expiresAt: draft.expiresAt || undefined, message: draft.message || undefined })
      setProposalTarget(null); refreshDashboard()
    } catch (err: any) { setError(err.message || 'Unable to send proposal.') } finally { setIsSubmittingProposal(false) }
  }

  const handleGenerateProposalDraft = async (draft: ProposalDraft) => {
    if (!proposalTarget) return undefined; setIsGeneratingProposalDraft(true)
    try {
      const data = await apiGenerateServiceProposalDraft(proposalTarget.requestId, { title: draft.title || undefined, amount: draft.amount || undefined, timeline: draft.timeline || undefined, focus: draft.message || draft.summary || undefined })
      return data.draft as Partial<ProposalDraft>
    } catch (err: any) { throw new Error(err.message || 'Unable to generate draft.') } finally { setIsGeneratingProposalDraft(false) }
  }

  return (
    <div className="fade-in">
      <header className="dashboard-hero mb-8 px-5 py-6 sm:px-7 sm:py-7 lg:px-8 lg:py-8">
        <div className="relative z-10 flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <div className="dashboard-kicker mb-4"><Star className="h-3.5 w-3.5" /> Freelancer workspace</div>
            <div className="mb-3 flex items-center gap-4">
              <h1 className="text-4xl font-black leading-tight tracking-tighter text-text-main md:text-5xl">Freelancer <span className="text-primary italic">Console</span></h1>
              <VerifiedBadge type="freelancer" />
            </div>
            <p className="text-base font-medium tracking-tight text-text-muted md:text-lg">Live overview of your services, profile strength, and conversation activity.</p>
            <div className="dashboard-actions">
              <button type="button" onClick={() => { setShowCreateForm((c) => !c); setEditingServiceId(null); setServiceForm(initialServiceForm); setServiceCopilotDraft(null) }} className="dashboard-action-chip">
                <PlusCircle className="h-4 w-4" /> {showCreateForm ? 'Close form' : 'Add Service'}
              </button>
              <Link to="/freelancers" className="dashboard-action-chip"><Briefcase className="h-4 w-4" /> Marketplace</Link>
              <Link to="/agreements" className="dashboard-action-chip"><Handshake className="h-4 w-4" /> Agreements</Link>
              <Link to="/proposals" className="dashboard-action-chip"><Handshake className="h-4 w-4" /> Proposals</Link>
            </div>
          </div>
          <div className="dashboard-panel relative flex min-w-0 items-center gap-5 px-5 py-5 sm:min-w-[20rem] sm:px-6">
            <div className="relative z-10 flex h-16 w-16 items-center justify-center">
              <svg className="h-16 w-16 -rotate-90 transform">
                <circle cx="32" cy="32" r="28" stroke="currentColor" strokeWidth="5" fill="transparent" className="text-surface-alt" />
                <circle cx="32" cy="32" r="28" stroke="currentColor" strokeWidth="5" fill="transparent" strokeDasharray={176} strokeDashoffset={176 - (176 * profileStrength) / 100} className="text-primary transition-all duration-1000" />
              </svg>
              <span className="absolute text-[11px] font-black">{profileStrength}%</span>
            </div>
            <div className="relative z-10">
              <p className="mb-2 text-[10px] font-black uppercase tracking-[0.2em] text-text-light">Profile Strength</p>
              <p className="mb-1 text-sm font-black text-text-main">{profileStrength >= 80 ? 'Strong Profile' : 'Build More Depth'}</p>
              <Link to="/onboarding" className="text-[10px] font-black uppercase tracking-widest text-primary hover:underline">Edit Profile</Link>
            </div>
          </div>
        </div>
      </header>

      {(error || dashboardError) ? <div className="mb-8 rounded-2xl border border-error/10 bg-error/5 px-4 py-3 text-sm font-semibold text-error">{error || (dashboardError instanceof Error ? dashboardError.message : 'Unable to load dashboard.')}</div> : null}

      <div className="metric-rail mb-10 md:mb-14">
        <div className="metric-card metric-card--solid flex items-center gap-5">
          <div className="h-14 w-14 bg-white/20 rounded-2xl flex items-center justify-center group-hover:bg-white/30 transition-all"><Award className="h-7 w-7" /></div>
          <div><p className="text-3xl font-black leading-none mb-1">{services.length}</p><p className="text-[10px] font-black opacity-80 uppercase tracking-widest">Listed Services</p></div>
        </div>
        <div className="metric-card flex items-center gap-5">
          <div className="h-14 w-14 text-secondary bg-surface-alt rounded-2xl flex items-center justify-center"><MessageSquare className="h-7 w-7" /></div>
          <div><p className="text-3xl font-black text-text-main leading-none mb-1">{unreadMessages}</p><p className="text-[10px] font-black text-text-light uppercase tracking-widest">Unread Messages</p></div>
        </div>
        <div className="metric-card flex items-center gap-5">
          <div className="h-14 w-14 text-accent bg-surface-alt rounded-2xl flex items-center justify-center"><UserCheck className="h-7 w-7" /></div>
          <div><p className="text-3xl font-black text-text-main leading-none mb-1">{pendingRequests}</p><p className="text-[10px] font-black text-text-light uppercase tracking-widest">Pending Requests</p></div>
        </div>
      </div>

      {isLoading ? (
        <div className="card bg-white border-surface-border p-10"><p className="text-sm font-black uppercase tracking-[0.2em] text-text-light">Loading freelancer dashboard...</p></div>
      ) : (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.65fr)_minmax(20rem,0.95fr)]">
          <div className="space-y-8">
            {/* Service create/edit form */}
            {(showCreateForm || isEditing) ? (
              <form onSubmit={isEditing ? handleUpdateService : handleCreateService} className="dashboard-panel p-5 sm:p-7 lg:p-8 space-y-6">
                <div className="flex justify-between items-center pb-6 border-b border-surface-border/50">
                  <h2 className="font-black text-xs uppercase tracking-[0.2em] text-text-main">{isEditing ? 'Edit Service' : 'Create Service'}</h2>
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">Live API</span>
                </div>
                <div className="rounded-[28px] border border-primary/15 bg-primary/5 p-5 sm:p-6">
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div>
                      <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.24em] text-primary"><Sparkles className="h-4 w-4" /> Service Copilot</p>
                      <h3 className="mt-3 text-lg font-black text-text-main">Optimize your listing with AI.</h3>
                    </div>
                    <button type="button" onClick={handleGenerateServiceDraft} disabled={isGeneratingServiceDraft} className="btn btn-secondary btn-sm rounded-2xl px-5 text-[10px] font-black uppercase tracking-widest disabled:opacity-60">
                      {isGeneratingServiceDraft ? 'Generating...' : 'Generate AI Draft'}
                    </button>
                  </div>
                  {serviceCopilotDraft ? (
                    <div className="mt-5 grid gap-3 md:grid-cols-2">
                      <div className="rounded-2xl border border-surface-border bg-white/80 p-4">
                        <p className="text-[10px] font-black uppercase tracking-[0.22em] text-text-light">Positioning</p>
                        <p className="mt-2 text-sm font-semibold leading-relaxed text-text-main">{serviceCopilotDraft.positioning || 'No positioning yet.'}</p>
                      </div>
                      <div className="rounded-2xl border border-surface-border bg-white/80 p-4">
                        <p className="text-[10px] font-black uppercase tracking-[0.22em] text-text-light">Pricing note</p>
                        <p className="mt-2 text-sm font-semibold leading-relaxed text-text-main">{serviceCopilotDraft.pricingNote || 'No pricing note yet.'}</p>
                      </div>
                    </div>
                  ) : null}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <input type="text" placeholder="Service title" value={serviceForm.title} onChange={(e) => setServiceForm((c) => ({ ...c, title: e.target.value }))} className="h-14 font-bold" required />
                  <input type="text" placeholder="Price" value={serviceForm.price} onChange={(e) => setServiceForm((c) => ({ ...c, price: e.target.value }))} className="h-14 font-bold" required />
                  <input type="text" placeholder="Delivery time" value={serviceForm.deliveryTime} onChange={(e) => setServiceForm((c) => ({ ...c, deliveryTime: e.target.value }))} className="h-14 font-bold" />
                  <input type="text" placeholder="Category" value={serviceForm.category} onChange={(e) => setServiceForm((c) => ({ ...c, category: e.target.value }))} className="h-14 font-bold" />
                </div>
                <textarea placeholder="Describe your service..." value={serviceForm.description} onChange={(e) => setServiceForm((c) => ({ ...c, description: e.target.value }))} className="min-h-[180px] font-bold py-4" required />
                <div className="flex gap-3 justify-end">
                  <button type="button" onClick={resetForm} className="btn btn-outline btn-lg px-6 rounded-2xl font-black uppercase tracking-widest">Cancel</button>
                  <button type="submit" disabled={isSubmitting} className="btn btn-primary btn-lg px-8 rounded-2xl font-black uppercase tracking-widest disabled:opacity-60">
                    {isSubmitting ? 'Publishing...' : isEditing ? 'Update Service' : 'Publish Service'}
                  </button>
                </div>
              </form>
            ) : null}

            {/* Services list */}
            <section className="dashboard-panel p-5 sm:p-7 lg:p-8">
              <div className="flex justify-between items-center mb-10 pb-6 border-b border-surface-border/50">
                <h2 className="font-black text-xs uppercase tracking-[0.2em] text-text-main">Your Services</h2>
                <Link to="/freelancers" className="text-[10px] font-black text-primary uppercase tracking-widest hover:underline flex items-center gap-2">View Marketplace <ChevronRight className="h-4 w-4" /></Link>
              </div>
              {services.length === 0 ? (
                <p className="text-sm font-semibold text-text-light">No services published yet.</p>
              ) : (
                <div className="space-y-4">
                  {services.map((s) => (
                    <div key={s.id} className="rounded-[1.75rem] border border-transparent bg-surface-alt/20 p-5 transition-all hover:border-surface-border hover:bg-white sm:p-6">
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                          <h3 className="font-black text-lg text-text-main tracking-tight mb-1 leading-none">{s.title}</h3>
                          <div className="flex items-center gap-3 mt-2">
                            <span className={`badge ${getApplicationBadgeClass(s.status)}`}>{s.status}</span>
                            <span className="text-sm font-black text-text-main">{formatMoney(s.price)}</span>
                            {s.category ? <span className="text-[10px] font-black uppercase tracking-widest text-text-light">{s.category}</span> : null}
                          </div>
                        </div>
                        <div className="flex gap-3 items-center">
                          <button type="button" disabled={isUpdatingServiceStatus} onClick={() => void handleServiceStatusUpdate(s.id, s.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE')} className="btn btn-outline btn-sm bg-white font-black uppercase tracking-widest text-[10px] disabled:opacity-60">{s.status === 'ACTIVE' ? 'Pause' : 'Activate'}</button>
                          <button type="button" onClick={() => startEditing(s)} className="btn btn-outline btn-sm bg-white font-black text-[10px]"><Pencil className="h-3.5 w-3.5" /></button>
                          <button type="button" onClick={() => void handleDeleteService(s.id)} className="btn btn-outline btn-sm bg-white font-black text-error text-[10px]"><Trash2 className="h-3.5 w-3.5" /></button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Incoming Requests */}
            <section className="dashboard-panel p-5 sm:p-7 lg:p-8">
              <div className="flex justify-between items-center mb-10 pb-6 border-b border-surface-border/50">
                <h2 className="font-black text-xs uppercase tracking-[0.2em] text-text-main">Incoming Requests</h2>
                <span className="badge bg-secondary text-white border-none text-[9px] uppercase tracking-widest">{pendingRequests} pending</span>
              </div>
              {requests.length === 0 ? (
                <p className="text-sm font-semibold text-text-light">No service requests received yet.</p>
              ) : (
                <div className="space-y-5">
                  {requests.map((request) => {
                    const clientName = request.client.role === 'EMPLOYER'
                      ? (request.client.employerProfile?.companyName || emailHandle(request.client.email))
                      : getDisplayName(request.client.jobSeekerProfile?.firstName, request.client.jobSeekerProfile?.lastName, request.client.email)
                    return (
                      <div key={request.id} className="rounded-[1.75rem] border border-surface-border bg-surface-alt/20 p-5 sm:p-6">
                        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                          <div className="flex-1">
                            <p className="text-lg font-black text-text-main">{request.service.title}</p>
                            <p className="mt-1 text-[10px] font-black uppercase tracking-[0.2em] text-text-light">{clientName} / {formatRelativeTime(request.createdAt)}</p>
                            <p className="mt-3 text-sm font-medium leading-relaxed text-text-muted">{request.message}</p>
                            <div className="mt-3 flex flex-wrap gap-2">
                              {request.budget ? <span className="rounded-full border border-surface-border bg-surface-alt/30 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-text-main">{request.budget}</span> : null}
                              {request.timeline ? <span className="rounded-full border border-surface-border bg-surface-alt/30 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-text-main">{request.timeline}</span> : null}
                            </div>
                          </div>
                          <div className="lg:w-[240px] space-y-3">
                            <div className="flex justify-between items-center">
                              <span className={`badge ${getRequestBadgeClass(request.status)}`}>{request.status}</span>
                              <div className="flex items-center gap-3">
                                {request.agreement ? <Link to="/agreements" className="text-[10px] font-black uppercase tracking-widest text-primary hover:underline">Agreement</Link> : null}
                                <Link to={`/messaging?userId=${request.client.id}&email=${encodeURIComponent(request.client.email)}`} className="text-[10px] font-black uppercase tracking-widest text-primary hover:underline">Message</Link>
                                {request.proposals?.[0] ? <Link to="/proposals" className="text-[10px] font-black uppercase tracking-widest text-primary hover:underline">Proposal</Link> : null}
                              </div>
                            </div>
                            {request.proposals?.[0] ? (
                              <div className="rounded-2xl border border-primary/10 bg-primary/5 px-4 py-3">
                                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">Active Proposal</p>
                                <p className="mt-1 text-sm font-black text-text-main">{request.proposals[0].title}</p>
                                <span className={`badge mt-2 ${getProposalBadgeClass(request.proposals[0].status)}`}>{request.proposals[0].status}</span>
                              </div>
                            ) : request.status === 'ACCEPTED' && !request.agreement ? (
                              <button type="button" onClick={() => setProposalTarget({ requestId: request.id, clientName, serviceTitle: request.service.title, suggestedAmount: request.budget, suggestedTimeline: request.timeline })} className="btn btn-outline btn-sm w-full justify-center border-primary/15 bg-white text-[10px] font-black uppercase tracking-widest text-primary hover:bg-primary/5">Send Proposal</button>
                            ) : null}
                            {request.status === 'PENDING' ? (
                              <div className="grid grid-cols-2 gap-2">
                                {requestStatuses.filter((s) => s !== request.status && s !== 'COMPLETED').map((status) => (
                                  <button key={status} type="button" disabled={isUpdatingRequest} onClick={() => void handleRequestStatusUpdate(request.id, status)} className={`rounded-xl px-3 py-2.5 text-[10px] font-black uppercase tracking-[0.2em] transition-all ${status === 'ACCEPTED' ? 'bg-success text-white' : 'bg-white border border-surface-border text-text-muted hover:border-primary hover:text-primary'} disabled:opacity-60`}>{status}</button>
                                ))}
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </section>
          </div>

          <aside className="space-y-6">
            {/* Profile Strength */}
            <div className="dashboard-panel border-primary/20 bg-gradient-to-br from-primary/5 to-white p-5 sm:p-6 overflow-hidden relative group/sidebar">
              <div className="absolute top-0 right-0 h-32 w-32 bg-primary/10 rounded-full -mr-16 -mt-16 blur-2xl group-hover/sidebar:bg-primary/20 transition-colors"></div>
              <div className="relative z-10">
                <h2 className="font-black text-xs uppercase tracking-[0.2em] text-primary mb-6 flex items-center gap-3"><ShieldCheck className="h-4 w-4" /> Profile Health</h2>
                <p className="text-sm text-text-muted font-medium leading-relaxed mb-4">Your freelancer profile is {profileStrength}% complete. Add more detail to increase visibility and trust.</p>
                <Link to="/onboarding" className="btn btn-primary btn-sm uppercase tracking-widest font-black text-[10px] w-full">Optimize Profile</Link>
              </div>
            </div>

            {/* Recent Messages */}
            <div className="dashboard-panel p-5 sm:p-6">
              <div className="flex justify-between items-center mb-6 pb-4 border-b border-surface-border/50">
                <h3 className="font-black text-[10px] uppercase tracking-widest text-text-main">Recent Messages</h3>
                <span className="badge bg-primary text-white border-none text-[9px] uppercase tracking-widest">{unreadMessages} unread</span>
              </div>
              {recentMessages.length === 0 ? (
                <p className="text-xs text-text-muted font-medium leading-relaxed">No recent conversations.</p>
              ) : (
                <div className="space-y-4">
                  {recentMessages.slice(0, 4).map((conv) => (
                    <Link key={conv.id} to={`/messaging?userId=${conv.participant.id}&email=${encodeURIComponent(conv.participant.email)}`} className="block rounded-2xl border border-surface-border bg-surface-alt/20 p-4 transition-all hover:bg-white hover:border-primary/15">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-black text-text-main truncate">{emailHandle(conv.participant.email)}</p>
                        {conv.unreadCount ? <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[9px] font-black text-white">{conv.unreadCount}</span> : null}
                      </div>
                      {conv.lastMessage ? <p className="mt-1 text-[11px] text-text-muted font-medium truncate">{conv.lastMessage.content || '📎 Attachment'}</p> : null}
                    </Link>
                  ))}
                </div>
              )}
              <Link to="/messaging" className="btn btn-outline btn-sm mt-6 w-full text-[10px] font-black uppercase tracking-widest">Open Inbox</Link>
            </div>

            <WorkflowSidebar
              activeAgreementCount={data?.activeAgreementCount ?? 0}
              upcomingMilestones={data?.upcomingMilestones ?? []}
              pendingProposalActions={data?.pendingProposalActions ?? 0}
              proposalActionItems={data?.proposalActionItems ?? []}
              pendingReviewActions={data?.pendingReviewActions ?? 0}
              reviewActionItems={data?.reviewActionItems ?? []}
              pendingDisputeActions={data?.pendingDisputeActions ?? 0}
              disputeActionItems={data?.disputeActionItems ?? []}
              pendingPaymentActions={data?.pendingPaymentActions ?? 0}
              paymentActionItems={data?.paymentActionItems ?? []}
            />

            <VerificationPanel type="freelancer" verification={data?.verification ?? null} isSubmitting={isUpdatingServiceStatus} onSubmit={handleSubmitVerification} />
          </aside>
        </div>
      )}

      <ProposalComposerModal
        isOpen={Boolean(proposalTarget)}
        heading={proposalTarget ? `Send proposal to ${proposalTarget.clientName}` : 'Send proposal'}
        subtitle={proposalTarget ? `Propose terms for ${proposalTarget.serviceTitle}.` : ''}
        defaultValue={proposalTarget ? { title: `${proposalTarget.serviceTitle} proposal`, amount: proposalTarget.suggestedAmount || '', timeline: proposalTarget.suggestedTimeline || '' } : undefined}
        isSubmitting={isSubmittingProposal}
        isGenerating={isGeneratingProposalDraft}
        error={error}
        submitLabel="Send Proposal"
        onGenerate={handleGenerateProposalDraft}
        onClose={() => setProposalTarget(null)}
        onSubmit={handleCreateProposal}
      />
    </div>
  )
}
