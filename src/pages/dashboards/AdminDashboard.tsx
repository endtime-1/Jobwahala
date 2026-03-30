import { type FormEvent, useEffect, useMemo, useState } from 'react'
import { ShieldCheck, Users, Briefcase, Flag, Wrench, Trash2, RefreshCw, BadgeCheck, AlertTriangle } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import {
  apiCreateAdminJob, apiDeleteAdminUser, apiUpdateAdminDisputeStatus,
  apiUpdateAdminJobsStatusBulk, apiUpdateAdminJobStatus,
  apiUpdateAdminReportsStatusBulk, apiUpdateAdminReportStatus,
  apiUpdateAdminServicesStatusBulk, apiUpdateAdminServiceStatus,
  apiUpdateAdminUsersStatusBulk, apiUpdateAdminUserStatus,
  apiUpdateAdminVerificationStatus,
} from '../../lib/api'
import { emailHandle, formatMoney, formatRelativeTime, getDisplayName } from '../../lib/display'
import { useAdminDashboard } from './admin/hooks'

const moderationStatuses = ['ACTIVE', 'FLAGGED', 'SUSPENDED']
const reportStatuses = ['PENDING', 'RESOLVED', 'DISMISSED']
const verificationStatuses = ['APPROVED', 'NEEDS_INFO', 'REJECTED']
const disputeStatuses = ['UNDER_REVIEW', 'RESOLVED', 'DISMISSED']
const initialAdminJobForm = { employerId: '', title: '', description: '', location: '', type: 'Full-time', salary: '', category: '' }

export default function AdminDashboard() {
  const queryClient = useQueryClient()
  const { data, isLoading, error: dashboardError } = useAdminDashboard()
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState<'reports' | 'users' | 'jobs' | 'services' | 'verifications' | 'disputes'>('reports')
  const [isActing, setIsActing] = useState(false)
  const [verificationDrafts, setVerificationDrafts] = useState<Record<string, { reviewNote: string; internalNote: string }>>({})
  const [adminJobForm, setAdminJobForm] = useState(initialAdminJobForm)
  const [companySearch, setCompanySearch] = useState('')
  const [jobSearch, setJobSearch] = useState('')
  const [jobCompanyFilter, setJobCompanyFilter] = useState('ALL')
  const [jobOriginFilter, setJobOriginFilter] = useState<'ALL' | 'ADMIN' | 'EMPLOYER'>('ALL')
  const [selectedReportIds, setSelectedReportIds] = useState<string[]>([])
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([])
  const [selectedJobIds, setSelectedJobIds] = useState<string[]>([])
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([])

  const reports = data?.reports ?? []
  const users = data?.users ?? []
  const jobs = data?.jobs ?? []
  const services = data?.services ?? []
  const verifications = data?.verifications ?? []
  const disputes = data?.disputes ?? []

  const refreshAll = () => void queryClient.invalidateQueries({ queryKey: ['admin'] })

  const handleAction = async (action: () => Promise<unknown>) => {
    setError(''); setIsActing(true)
    try { await action(); refreshAll() } catch (err: any) { setError(err.message || 'Admin action failed.') } finally { setIsActing(false) }
  }

  const summary = useMemo(() => ({
    flaggedUsers: users.filter((u) => ['FLAGGED', 'SUSPENDED'].includes(u.status)).length,
    flaggedJobs: jobs.filter((j) => ['FLAGGED', 'SUSPENDED'].includes(j.status)).length,
    flaggedServices: services.filter((s) => ['FLAGGED', 'SUSPENDED'].includes(s.status)).length,
    pendingVerifications: verifications.filter((v) => v.status === 'PENDING').length,
    activeDisputes: disputes.filter((d) => ['OPEN', 'UNDER_REVIEW'].includes(d.status)).length,
  }), [disputes, jobs, services, users, verifications])

  const employerCompanies = useMemo(() => users.filter((u) => u.role === 'EMPLOYER' && u.status === 'ACTIVE' && Boolean(u.employerProfile?.companyName)).sort((a, b) => (a.employerProfile?.companyName || a.email).localeCompare(b.employerProfile?.companyName || b.email)), [users])
  const filteredEmployerCompanies = useMemo(() => { const q = companySearch.trim().toLowerCase(); if (!q) return employerCompanies; return employerCompanies.filter((u) => (u.employerProfile?.companyName || '').toLowerCase().includes(q) || u.email.toLowerCase().includes(q)) }, [companySearch, employerCompanies])
  const jobCompanyOptions = useMemo(() => Array.from(new Map(jobs.map((j) => [j.employer.email, { value: j.employer.email, label: j.employer.employerProfile?.companyName || emailHandle(j.employer.email) }])).values()).sort((a, b) => a.label.localeCompare(b.label)), [jobs])

  const filteredJobs = useMemo(() => {
    const q = jobSearch.trim().toLowerCase()
    return jobs.filter((job) => {
      const company = job.employer.employerProfile?.companyName || job.employer.email
      const matchesQuery = !q || job.title.toLowerCase().includes(q) || company.toLowerCase().includes(q) || (job.postedByAdmin?.email || '').toLowerCase().includes(q)
      const matchesCompany = jobCompanyFilter === 'ALL' || job.employer.email === jobCompanyFilter
      const matchesOrigin = jobOriginFilter === 'ALL' || (jobOriginFilter === 'ADMIN' ? Boolean(job.postedByAdmin) : !job.postedByAdmin)
      return matchesQuery && matchesCompany && matchesOrigin
    })
  }, [jobCompanyFilter, jobOriginFilter, jobSearch, jobs])

  useEffect(() => { setSelectedReportIds((c) => c.filter((id) => reports.some((r) => r.id === id))) }, [reports])
  useEffect(() => { setSelectedUserIds((c) => c.filter((id) => users.some((u) => u.id === id))) }, [users])
  useEffect(() => { setSelectedJobIds((c) => c.filter((id) => jobs.some((j) => j.id === id))) }, [jobs])
  useEffect(() => { setSelectedServiceIds((c) => c.filter((id) => services.some((s) => s.id === id))) }, [services])

  const updateVerificationDraft = (id: string, field: 'reviewNote' | 'internalNote', value: string) => {
    setVerificationDrafts((c) => ({ ...c, [id]: { reviewNote: c[id]?.reviewNote || '', internalNote: c[id]?.internalNote || '', [field]: value } }))
  }

  const handleVerificationAction = (id: string, status: 'APPROVED' | 'NEEDS_INFO' | 'REJECTED') => {
    const draft = verificationDrafts[id] || { reviewNote: '', internalNote: '' }
    const reviewNote = draft.reviewNote.trim() || undefined
    const internalNote = draft.internalNote.trim() || undefined
    if (status === 'NEEDS_INFO' && !reviewNote) { setError('A requester-facing note is required.'); return }
    void handleAction(async () => { await apiUpdateAdminVerificationStatus(id, status, reviewNote, internalNote); setVerificationDrafts((c) => { const n = { ...c }; delete n[id]; return n }) })
  }

  const handleCreateAdminJob = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setError('')
    if (!adminJobForm.employerId) { setError('Select the employer company.'); return }
    void handleAction(async () => { await apiCreateAdminJob({ employerId: adminJobForm.employerId, title: adminJobForm.title, description: adminJobForm.description, location: adminJobForm.location || undefined, type: adminJobForm.type, salary: adminJobForm.salary || undefined, category: adminJobForm.category || undefined }); setAdminJobForm(initialAdminJobForm) })
  }

  // Bulk selection helpers
  const toggleId = (id: string, setter: React.Dispatch<React.SetStateAction<string[]>>) => setter((c) => c.includes(id) ? c.filter((v) => v !== id) : [...c, id])
  const handleBulk = (ids: string[], status: string, apiFn: (ids: string[], status: string) => Promise<unknown>, setter: React.Dispatch<React.SetStateAction<string[]>>) => {
    if (ids.length === 0) { setError('Select at least one item.'); return }
    void handleAction(async () => { await apiFn(ids, status); setter([]) })
  }

  return (
    <div className="fade-in">
      <header className="dashboard-hero mb-8 px-5 py-6 sm:px-7 sm:py-7 lg:px-8 lg:py-8">
        <div className="relative z-10 flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <div className="dashboard-kicker mb-4"><ShieldCheck className="h-3.5 w-3.5" /> Moderation console</div>
            <h1 className="mb-3 text-4xl font-black leading-tight tracking-tighter text-text-main md:text-5xl">Admin control across reports, people, jobs, and services.</h1>
            <p className="text-base font-medium tracking-tight text-text-muted md:text-lg">Review reports, moderate users, and manage job and service visibility from a single operations surface.</p>
          </div>
          <div className="dashboard-panel px-5 py-5 sm:min-w-[16rem] sm:px-6">
            <button type="button" onClick={refreshAll} disabled={isActing} className="btn btn-primary btn-lg flex w-full items-center justify-center gap-3 rounded-2xl px-8 text-sm font-black uppercase tracking-widest shadow-primary/20 transition-all disabled:opacity-60">
              <RefreshCw className={`h-5 w-5 ${isActing ? 'animate-spin' : ''}`} /> Refresh
            </button>
          </div>
        </div>
      </header>

      {(error || dashboardError) ? <div className="mb-8 rounded-2xl border border-error/10 bg-error/5 px-4 py-3 text-sm font-semibold text-error">{error || (dashboardError instanceof Error ? dashboardError.message : 'Unable to load.')}</div> : null}

      <div className="metric-rail mb-10 md:mb-14 xl:grid-cols-6">
        {[
          { icon: Flag, value: reports.length, label: 'Reports', color: 'primary' },
          { icon: Users, value: summary.flaggedUsers, label: 'Flagged Users', color: 'secondary' },
          { icon: Briefcase, value: summary.flaggedJobs, label: 'Flagged Jobs', color: 'accent' },
          { icon: Wrench, value: summary.flaggedServices, label: 'Flagged Services', color: 'success' },
          { icon: BadgeCheck, value: summary.pendingVerifications, label: 'Pending Verifications', color: 'accent' },
          { icon: AlertTriangle, value: summary.activeDisputes, label: 'Active Disputes', color: 'error' },
        ].map((m, i) => (
          <div key={m.label} className={i === 0 ? 'metric-card metric-card--solid' : 'metric-card'}>
            <div className="flex items-center gap-4 mb-4">
              <div className={`h-12 w-12 rounded-2xl bg-${m.color}/10 text-${m.color} flex items-center justify-center`}><m.icon className="h-6 w-6" /></div>
              <div><p className="text-3xl font-black text-text-main">{m.value}</p><p className="text-[10px] font-black uppercase tracking-[0.2em] text-text-light">{m.label}</p></div>
            </div>
          </div>
        ))}
      </div>

      <div className="dashboard-actions mb-8">
        {(['reports', 'users', 'jobs', 'services', 'verifications', 'disputes'] as const).map((tab) => (
          <button key={tab} type="button" onClick={() => setActiveTab(tab)} className={`dashboard-action-chip ${activeTab === tab ? 'border-primary/30 bg-primary/10 text-primary' : ''}`}>{tab.charAt(0).toUpperCase() + tab.slice(1)}</button>
        ))}
      </div>

      {isLoading ? (
        <div className="dashboard-panel p-6 sm:p-10"><p className="text-sm font-black uppercase tracking-[0.2em] text-text-light">Loading admin dashboard...</p></div>
      ) : (
        <div className="dashboard-panel p-5 sm:p-7 lg:p-8">
          {activeTab === 'reports' ? (
            <div className="space-y-6">
              <div className="rounded-3xl border border-surface-border bg-white/80 p-5 sm:p-6">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                  <div><p className="text-[10px] font-black uppercase tracking-[0.2em] text-text-light">Bulk moderation</p><p className="mt-2 text-sm font-semibold text-text-muted">{selectedReportIds.length} report{selectedReportIds.length === 1 ? '' : 's'} selected.</p></div>
                  <div className="flex flex-wrap items-center gap-3">
                    <button type="button" onClick={() => setSelectedReportIds(reports.map((r) => r.id))} disabled={reports.length === 0} className="rounded-xl border border-surface-border bg-white px-4 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-text-muted transition-all hover:border-primary hover:text-primary disabled:opacity-60">Select Visible</button>
                    <button type="button" onClick={() => setSelectedReportIds([])} disabled={selectedReportIds.length === 0} className="rounded-xl border border-surface-border bg-white px-4 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-text-muted transition-all hover:border-primary hover:text-primary disabled:opacity-60">Clear</button>
                    {reportStatuses.map((s) => (<button key={`bulk-r-${s}`} type="button" disabled={isActing || selectedReportIds.length === 0} onClick={() => handleBulk(selectedReportIds, s, apiUpdateAdminReportsStatusBulk, setSelectedReportIds)} className="rounded-xl px-4 py-2 text-[10px] font-black uppercase tracking-[0.2em] transition-all bg-primary/10 text-primary hover:bg-primary hover:text-white disabled:opacity-60">Set {s}</button>))}
                  </div>
                </div>
              </div>
              {reports.length === 0 ? <p className="text-sm font-semibold text-text-light">No reports submitted yet.</p> : reports.map((report) => (
                <div key={report.id} className={`rounded-3xl border p-6 transition-all ${selectedReportIds.includes(report.id) ? 'border-primary/40 bg-primary/5' : 'border-surface-border bg-surface-alt/20'}`}>
                  <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-4">
                    <div className="flex items-start gap-4">
                      <label className="mt-1 flex items-center"><input type="checkbox" aria-label={`Select report ${report.id}`} checked={selectedReportIds.includes(report.id)} onChange={() => toggleId(report.id, setSelectedReportIds)} className="h-4 w-4 rounded border-surface-border text-primary focus:ring-primary" /></label>
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-text-light mb-2">{report.job ? 'Job report' : report.service ? 'Service report' : 'User report'} / {formatRelativeTime(report.createdAt)}</p>
                        <p className="text-xl font-black text-text-main">{report.job?.title || report.service?.title || report.reportedUser?.email || 'Unknown target'}</p>
                        <p className="text-sm font-bold text-text-muted">Reporter: {report.reporter.email}{report.reportedUser ? ` / ${report.reportedUser.role}` : ''}</p>
                      </div>
                    </div>
                    <span className="badge bg-primary text-white">{report.status}</span>
                  </div>
                  <p className="text-sm text-text-main leading-relaxed whitespace-pre-wrap">{report.reason}</p>
                  <div className="mt-4 flex flex-wrap gap-3">
                    {reportStatuses.map((s) => (<button key={s} type="button" disabled={isActing || report.status === s} onClick={() => handleAction(() => apiUpdateAdminReportStatus(report.id, s))} className={`rounded-xl px-4 py-2 text-[10px] font-black uppercase tracking-[0.2em] transition-all ${report.status === s ? 'bg-primary text-white' : 'bg-white border border-surface-border text-text-muted hover:border-primary hover:text-primary'}`}>{s}</button>))}
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          {activeTab === 'users' ? (
            <div className="space-y-6">
              <div className="rounded-3xl border border-surface-border bg-white/80 p-5 sm:p-6">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                  <div><p className="text-[10px] font-black uppercase tracking-[0.2em] text-text-light">Bulk moderation</p><p className="mt-2 text-sm font-semibold text-text-muted">{selectedUserIds.length} user{selectedUserIds.length === 1 ? '' : 's'} selected.</p></div>
                  <div className="flex flex-wrap items-center gap-3">
                    <button type="button" onClick={() => setSelectedUserIds(users.map((u) => u.id))} disabled={users.length === 0} className="rounded-xl border border-surface-border bg-white px-4 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-text-muted transition-all hover:border-primary hover:text-primary disabled:opacity-60">Select Visible</button>
                    <button type="button" onClick={() => setSelectedUserIds([])} disabled={selectedUserIds.length === 0} className="rounded-xl border border-surface-border bg-white px-4 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-text-muted transition-all hover:border-primary hover:text-primary disabled:opacity-60">Clear</button>
                    {moderationStatuses.map((s) => (<button key={`bulk-u-${s}`} type="button" disabled={isActing || selectedUserIds.length === 0} onClick={() => handleBulk(selectedUserIds, s, apiUpdateAdminUsersStatusBulk, setSelectedUserIds)} className="rounded-xl px-4 py-2 text-[10px] font-black uppercase tracking-[0.2em] transition-all bg-primary/10 text-primary hover:bg-primary hover:text-white disabled:opacity-60">Set {s}</button>))}
                  </div>
                </div>
              </div>
              {users.length === 0 ? <div className="rounded-3xl border border-dashed border-surface-border bg-surface-alt/10 p-6 text-sm font-semibold text-text-light">No users in moderation queue.</div> : null}
              {users.map((user) => (
                <div key={user.id} className={`rounded-3xl border p-6 transition-all ${selectedUserIds.includes(user.id) ? 'border-primary/40 bg-primary/5' : 'border-surface-border bg-surface-alt/20'}`}>
                  <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
                    <div className="flex items-start gap-4">
                      <label className="mt-1 flex items-center"><input type="checkbox" aria-label={`Select ${user.email}`} checked={selectedUserIds.includes(user.id)} onChange={() => toggleId(user.id, setSelectedUserIds)} className="h-4 w-4 rounded border-surface-border text-primary focus:ring-primary" /></label>
                      <div><p className="text-xl font-black text-text-main">{user.email}</p><p className="text-[10px] font-black uppercase tracking-[0.2em] text-text-light mt-2">{user.role} / joined {formatRelativeTime(user.createdAt)}</p></div>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      {moderationStatuses.map((s) => (<button key={s} type="button" disabled={isActing || user.status === s} onClick={() => handleAction(() => apiUpdateAdminUserStatus(user.id, s))} className={`rounded-xl px-4 py-2 text-[10px] font-black uppercase tracking-[0.2em] transition-all ${user.status === s ? 'bg-primary text-white' : 'bg-white border border-surface-border text-text-muted hover:border-primary hover:text-primary'}`}>{s}</button>))}
                      <button type="button" disabled={isActing} onClick={() => { if (window.confirm(`Delete user ${user.email}?`)) void handleAction(() => apiDeleteAdminUser(user.id)) }} className="rounded-xl px-4 py-2 text-[10px] font-black uppercase tracking-[0.2em] bg-error/10 text-error hover:bg-error/20 transition-all"><Trash2 className="inline h-3.5 w-3.5 mr-2" />Delete</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          {activeTab === 'jobs' ? (
            <div className="space-y-6">
              <form onSubmit={handleCreateAdminJob} className="rounded-3xl border border-surface-border bg-white/80 p-6">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="max-w-2xl"><p className="text-[10px] font-black uppercase tracking-[0.2em] text-text-light mb-2">Admin posting desk</p><h2 className="text-2xl font-black tracking-tight text-text-main">Post a job on behalf of a company</h2><p className="mt-2 text-sm font-semibold text-text-muted">Select an active employer company and publish a role.</p></div>
                  <button type="submit" disabled={isActing || employerCompanies.length === 0} className="btn btn-primary btn-lg rounded-2xl px-6 text-sm font-black uppercase tracking-[0.2em] disabled:opacity-60">{isActing ? 'Posting...' : 'Post Job'}</button>
                </div>
                <div className="mt-6 grid gap-4 xl:grid-cols-2">
                  <div className="xl:col-span-2"><label htmlFor="admin-job-company-search" className="block text-[10px] font-black uppercase tracking-[0.2em] text-text-light">Find company</label><input id="admin-job-company-search" value={companySearch} onChange={(e) => setCompanySearch(e.target.value)} className="mt-2 w-full rounded-2xl border border-surface-border bg-white px-4 py-3 text-sm font-semibold text-text-main outline-none focus:border-primary" placeholder="Search by company or email" /><p className="mt-2 text-[10px] font-semibold text-text-light">Showing {filteredEmployerCompanies.length} of {employerCompanies.length} companies.</p></div>
                  <div className="xl:col-span-2"><label htmlFor="admin-job-company" className="block text-[10px] font-black uppercase tracking-[0.2em] text-text-light">Company</label><select id="admin-job-company" value={adminJobForm.employerId} onChange={(e) => setAdminJobForm((c) => ({ ...c, employerId: e.target.value }))} className="mt-2 w-full rounded-2xl border border-surface-border bg-white px-4 py-3 text-sm font-semibold text-text-main outline-none focus:border-primary"><option value="">Select a company</option>{filteredEmployerCompanies.map((u) => (<option key={u.id} value={u.id}>{u.employerProfile?.companyName} ({emailHandle(u.email)})</option>))}</select></div>
                  <div><label htmlFor="admin-job-title" className="block text-[10px] font-black uppercase tracking-[0.2em] text-text-light">Role title</label><input id="admin-job-title" value={adminJobForm.title} onChange={(e) => setAdminJobForm((c) => ({ ...c, title: e.target.value }))} className="mt-2 w-full rounded-2xl border border-surface-border bg-white px-4 py-3 text-sm font-semibold text-text-main outline-none focus:border-primary" placeholder="Senior Backend Engineer" /></div>
                  <div><label htmlFor="admin-job-type" className="block text-[10px] font-black uppercase tracking-[0.2em] text-text-light">Job type</label><input id="admin-job-type" value={adminJobForm.type} onChange={(e) => setAdminJobForm((c) => ({ ...c, type: e.target.value }))} className="mt-2 w-full rounded-2xl border border-surface-border bg-white px-4 py-3 text-sm font-semibold text-text-main outline-none focus:border-primary" placeholder="Full-time" /></div>
                  <div><label htmlFor="admin-job-location" className="block text-[10px] font-black uppercase tracking-[0.2em] text-text-light">Location / work mode</label><input id="admin-job-location" value={adminJobForm.location} onChange={(e) => setAdminJobForm((c) => ({ ...c, location: e.target.value }))} className="mt-2 w-full rounded-2xl border border-surface-border bg-white px-4 py-3 text-sm font-semibold text-text-main outline-none focus:border-primary" placeholder="Remote, Hybrid, or Accra" /></div>
                  <div><label htmlFor="admin-job-salary" className="block text-[10px] font-black uppercase tracking-[0.2em] text-text-light">Salary</label><input id="admin-job-salary" value={adminJobForm.salary} onChange={(e) => setAdminJobForm((c) => ({ ...c, salary: e.target.value }))} className="mt-2 w-full rounded-2xl border border-surface-border bg-white px-4 py-3 text-sm font-semibold text-text-main outline-none focus:border-primary" placeholder="GHS 8,000 / month" /></div>
                  <div className="xl:col-span-2"><label htmlFor="admin-job-category" className="block text-[10px] font-black uppercase tracking-[0.2em] text-text-light">Category</label><input id="admin-job-category" value={adminJobForm.category} onChange={(e) => setAdminJobForm((c) => ({ ...c, category: e.target.value }))} className="mt-2 w-full rounded-2xl border border-surface-border bg-white px-4 py-3 text-sm font-semibold text-text-main outline-none focus:border-primary" placeholder="Engineering" /></div>
                  <div className="xl:col-span-2"><label htmlFor="admin-job-description" className="block text-[10px] font-black uppercase tracking-[0.2em] text-text-light">Description</label><textarea id="admin-job-description" value={adminJobForm.description} onChange={(e) => setAdminJobForm((c) => ({ ...c, description: e.target.value }))} className="mt-2 min-h-[160px] w-full rounded-2xl border border-surface-border bg-white px-4 py-3 text-sm text-text-main outline-none focus:border-primary" placeholder="Describe the role..." /></div>
                </div>
              </form>
              <div className="rounded-3xl border border-surface-border bg-surface-alt/10 p-5 sm:p-6">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
                  <div><p className="text-[10px] font-black uppercase tracking-[0.2em] text-text-light">Job inventory filters</p><p className="mt-2 text-sm font-semibold text-text-muted">Showing {filteredJobs.length} of {jobs.length} jobs.</p></div>
                  <div className="grid gap-4 xl:grid-cols-3 xl:items-end">
                    <div><label htmlFor="admin-job-search" className="block text-[10px] font-black uppercase tracking-[0.2em] text-text-light">Search jobs</label><input id="admin-job-search" value={jobSearch} onChange={(e) => setJobSearch(e.target.value)} className="mt-2 w-full rounded-2xl border border-surface-border bg-white px-4 py-3 text-sm font-semibold text-text-main outline-none focus:border-primary" placeholder="Role, company, or admin email" /></div>
                    <div><label htmlFor="admin-job-company-filter" className="block text-[10px] font-black uppercase tracking-[0.2em] text-text-light">Company filter</label><select id="admin-job-company-filter" value={jobCompanyFilter} onChange={(e) => setJobCompanyFilter(e.target.value)} className="mt-2 w-full rounded-2xl border border-surface-border bg-white px-4 py-3 text-sm font-semibold text-text-main outline-none focus:border-primary"><option value="ALL">All companies</option>{jobCompanyOptions.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}</select></div>
                    <div><label htmlFor="admin-job-origin-filter" className="block text-[10px] font-black uppercase tracking-[0.2em] text-text-light">Posting origin</label><select id="admin-job-origin-filter" value={jobOriginFilter} onChange={(e) => setJobOriginFilter(e.target.value as any)} className="mt-2 w-full rounded-2xl border border-surface-border bg-white px-4 py-3 text-sm font-semibold text-text-main outline-none focus:border-primary"><option value="ALL">All origins</option><option value="ADMIN">Admin assisted</option><option value="EMPLOYER">Employer posted</option></select></div>
                  </div>
                </div>
              </div>
              <div className="rounded-3xl border border-surface-border bg-white/80 p-5 sm:p-6">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                  <div><p className="text-[10px] font-black uppercase tracking-[0.2em] text-text-light">Bulk moderation</p><p className="mt-2 text-sm font-semibold text-text-muted">{selectedJobIds.length} job{selectedJobIds.length === 1 ? '' : 's'} selected.</p></div>
                  <div className="flex flex-wrap items-center gap-3">
                    <button type="button" onClick={() => setSelectedJobIds(filteredJobs.map((j) => j.id))} disabled={filteredJobs.length === 0} className="rounded-xl border border-surface-border bg-white px-4 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-text-muted transition-all hover:border-primary hover:text-primary disabled:opacity-60">Select Visible</button>
                    <button type="button" onClick={() => setSelectedJobIds([])} disabled={selectedJobIds.length === 0} className="rounded-xl border border-surface-border bg-white px-4 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-text-muted transition-all hover:border-primary hover:text-primary disabled:opacity-60">Clear</button>
                    {moderationStatuses.map((s) => (<button key={`bulk-j-${s}`} type="button" disabled={isActing || selectedJobIds.length === 0} onClick={() => handleBulk(selectedJobIds, s, apiUpdateAdminJobsStatusBulk, setSelectedJobIds)} className="rounded-xl px-4 py-2 text-[10px] font-black uppercase tracking-[0.2em] transition-all bg-primary/10 text-primary hover:bg-primary hover:text-white disabled:opacity-60">Set {s}</button>))}
                  </div>
                </div>
              </div>
              {filteredJobs.length === 0 ? <div className="rounded-3xl border border-dashed border-surface-border bg-surface-alt/10 p-6 text-sm font-semibold text-text-light">No jobs match the current filters.</div> : filteredJobs.map((job) => {
                const company = job.employer.employerProfile?.companyName || emailHandle(job.employer.email)
                return (
                  <div key={job.id} className={`rounded-3xl border p-6 transition-all ${selectedJobIds.includes(job.id) ? 'border-primary/40 bg-primary/5' : 'border-surface-border bg-surface-alt/20'}`}>
                    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
                      <div className="flex items-start gap-4">
                        <label className="mt-1 flex items-center"><input type="checkbox" aria-label={`Select ${job.title}`} checked={selectedJobIds.includes(job.id)} onChange={() => toggleId(job.id, setSelectedJobIds)} className="h-4 w-4 rounded border-surface-border text-primary focus:ring-primary" /></label>
                        <div><p className="text-xl font-black text-text-main">{job.title}</p><p className="text-sm font-bold text-text-muted">{company}</p>{job.postedByAdmin ? <p className="mt-2 text-[10px] font-black uppercase tracking-[0.2em] text-secondary">Admin posted / {emailHandle(job.postedByAdmin.email)}</p> : null}<p className="text-[10px] font-black uppercase tracking-[0.2em] text-text-light mt-2">{job._count.applications} applicants / {job.salary || 'Salary not listed'} / {formatRelativeTime(job.createdAt)}</p></div>
                      </div>
                      <div className="flex flex-wrap items-center gap-3">
                        {moderationStatuses.map((s) => (<button key={s} type="button" disabled={isActing || job.status === s} onClick={() => handleAction(() => apiUpdateAdminJobStatus(job.id, s))} className={`rounded-xl px-4 py-2 text-[10px] font-black uppercase tracking-[0.2em] transition-all ${job.status === s ? 'bg-primary text-white' : 'bg-white border border-surface-border text-text-muted hover:border-primary hover:text-primary'}`}>{s}</button>))}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : null}

          {activeTab === 'services' ? (
            <div className="space-y-6">
              <div className="rounded-3xl border border-surface-border bg-white/80 p-5 sm:p-6">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                  <div><p className="text-[10px] font-black uppercase tracking-[0.2em] text-text-light">Bulk moderation</p><p className="mt-2 text-sm font-semibold text-text-muted">{selectedServiceIds.length} service{selectedServiceIds.length === 1 ? '' : 's'} selected.</p></div>
                  <div className="flex flex-wrap items-center gap-3">
                    <button type="button" onClick={() => setSelectedServiceIds(services.map((s) => s.id))} disabled={services.length === 0} className="rounded-xl border border-surface-border bg-white px-4 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-text-muted transition-all hover:border-primary hover:text-primary disabled:opacity-60">Select Visible</button>
                    <button type="button" onClick={() => setSelectedServiceIds([])} disabled={selectedServiceIds.length === 0} className="rounded-xl border border-surface-border bg-white px-4 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-text-muted transition-all hover:border-primary hover:text-primary disabled:opacity-60">Clear</button>
                    {moderationStatuses.map((s) => (<button key={`bulk-s-${s}`} type="button" disabled={isActing || selectedServiceIds.length === 0} onClick={() => handleBulk(selectedServiceIds, s, apiUpdateAdminServicesStatusBulk, setSelectedServiceIds)} className="rounded-xl px-4 py-2 text-[10px] font-black uppercase tracking-[0.2em] transition-all bg-primary/10 text-primary hover:bg-primary hover:text-white disabled:opacity-60">Set {s}</button>))}
                  </div>
                </div>
              </div>
              {services.length === 0 ? <div className="rounded-3xl border border-dashed border-surface-border bg-surface-alt/10 p-6 text-sm font-semibold text-text-light">No services in moderation queue.</div> : null}
              {services.map((service) => {
                const name = getDisplayName(service.freelancer.freelancerProfile?.firstName, service.freelancer.freelancerProfile?.lastName, service.freelancer.email)
                return (
                  <div key={service.id} className={`rounded-3xl border p-6 transition-all ${selectedServiceIds.includes(service.id) ? 'border-primary/40 bg-primary/5' : 'border-surface-border bg-surface-alt/20'}`}>
                    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
                      <div className="flex items-start gap-4">
                        <label className="mt-1 flex items-center"><input type="checkbox" aria-label={`Select ${service.title}`} checked={selectedServiceIds.includes(service.id)} onChange={() => toggleId(service.id, setSelectedServiceIds)} className="h-4 w-4 rounded border-surface-border text-primary focus:ring-primary" /></label>
                        <div><p className="text-xl font-black text-text-main">{service.title}</p><p className="text-sm font-bold text-text-muted">{name}</p><p className="text-[10px] font-black uppercase tracking-[0.2em] text-text-light mt-2">{service.category || 'General'} / {formatMoney(service.price)} / {formatRelativeTime(service.createdAt)}</p></div>
                      </div>
                      <div className="flex flex-wrap items-center gap-3">
                        {moderationStatuses.map((s) => (<button key={s} type="button" disabled={isActing || service.status === s} onClick={() => handleAction(() => apiUpdateAdminServiceStatus(service.id, s))} className={`rounded-xl px-4 py-2 text-[10px] font-black uppercase tracking-[0.2em] transition-all ${service.status === s ? 'bg-primary text-white' : 'bg-white border border-surface-border text-text-muted hover:border-primary hover:text-primary'}`}>{s}</button>))}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : null}

          {activeTab === 'verifications' ? (
            <div className="space-y-6">
              {verifications.length === 0 ? <p className="text-sm font-semibold text-text-light">No verification requests submitted yet.</p> : verifications.map((v) => {
                const draft = verificationDrafts[v.id] || { reviewNote: '', internalNote: '' }
                const name = v.user.employerProfile?.companyName || getDisplayName(v.user.jobSeekerProfile?.firstName || v.user.freelancerProfile?.firstName, v.user.jobSeekerProfile?.lastName || v.user.freelancerProfile?.lastName, v.user.email)
                return (
                  <div key={v.id} className="rounded-3xl border border-surface-border bg-surface-alt/20 p-6">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-text-light mb-2">{v.type} / {v.user.role} / {formatRelativeTime(v.createdAt)}</p>
                        <p className="text-xl font-black text-text-main">{name}</p>
                        <p className="text-sm font-bold text-text-muted">{v.user.email}</p>
                        <p className="mt-4 text-sm text-text-main leading-relaxed whitespace-pre-wrap">{v.details}</p>
                        {v.documentUrl ? <a href={v.documentUrl} target="_blank" rel="noreferrer" className="mt-4 inline-flex text-[10px] font-black uppercase tracking-[0.2em] text-primary hover:underline">Open evidence</a> : null}
                        {v.reviewNote ? <p className="mt-4 rounded-2xl border border-surface-border bg-white px-4 py-3 text-xs font-semibold text-text-muted">Review note: {v.reviewNote}</p> : null}
                        {v.internalNote ? <p className="mt-3 rounded-2xl border border-secondary/10 bg-secondary/5 px-4 py-3 text-xs font-semibold text-text-muted">Internal note: {v.internalNote}</p> : null}
                        {v.history?.length ? (
                          <div className="mt-5 rounded-2xl border border-surface-border bg-white px-4 py-4">
                            <div className="flex items-center justify-between gap-3"><p className="text-[10px] font-black uppercase tracking-[0.2em] text-text-light">Previous submissions</p><span className="badge bg-surface-alt text-text-main">{v.submissionCount || v.history.length + 1}</span></div>
                            <div className="mt-4 space-y-3">
                              {v.history.map((entry) => (
                                <div key={entry.id} className="rounded-2xl border border-surface-border bg-surface px-4 py-3">
                                  <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-[10px] font-black uppercase tracking-[0.2em] text-text-light">{entry.status} / {formatRelativeTime(entry.createdAt)}</p>{entry.reviewer?.email ? <p className="text-[10px] font-black uppercase tracking-[0.2em] text-text-light">Reviewed by {entry.reviewer.email}</p> : null}</div>
                                  <p className="mt-3 text-xs font-semibold leading-relaxed text-text-muted whitespace-pre-wrap">{entry.details}</p>
                                  {entry.reviewNote ? <p className="mt-3 rounded-2xl border border-surface-border bg-white px-3 py-2 text-xs font-semibold text-text-muted">Review note: {entry.reviewNote}</p> : null}
                                  {entry.internalNote ? <p className="mt-3 rounded-2xl border border-secondary/10 bg-secondary/5 px-3 py-2 text-xs font-semibold text-text-muted">Internal note: {entry.internalNote}</p> : null}
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : null}
                        {v.status === 'PENDING' ? (
                          <div className="mt-5 grid gap-4 xl:grid-cols-2">
                            <div><label htmlFor={`vr-note-${v.id}`} className="block text-[10px] font-black uppercase tracking-[0.2em] text-text-light">Requester-facing note</label><textarea id={`vr-note-${v.id}`} value={draft.reviewNote} onChange={(e) => updateVerificationDraft(v.id, 'reviewNote', e.target.value)} className="mt-2 min-h-[110px] w-full rounded-2xl border border-surface-border bg-white px-4 py-3 text-sm text-text-main outline-none focus:border-primary" placeholder="Tell the requester what to improve." /><p className="mt-2 text-[10px] font-semibold text-text-light">Required for NEEDS_INFO.</p></div>
                            <div><label htmlFor={`vi-note-${v.id}`} className="block text-[10px] font-black uppercase tracking-[0.2em] text-text-light">Internal admin note</label><textarea id={`vi-note-${v.id}`} value={draft.internalNote} onChange={(e) => updateVerificationDraft(v.id, 'internalNote', e.target.value)} className="mt-2 min-h-[110px] w-full rounded-2xl border border-surface-border bg-white px-4 py-3 text-sm text-text-main outline-none focus:border-primary" placeholder="Private moderation context." /><p className="mt-2 text-[10px] font-semibold text-text-light">Optional. Admin-only.</p></div>
                          </div>
                        ) : null}
                      </div>
                      <div className="flex flex-wrap items-center gap-3">
                        <span className={`badge ${v.status === 'APPROVED' ? 'bg-success text-white' : v.status === 'REJECTED' ? 'bg-error text-white' : v.status === 'NEEDS_INFO' ? 'bg-secondary text-white' : 'bg-primary text-white'}`}>{v.status}</span>
                        {verificationStatuses.map((s) => (<button key={s} type="button" disabled={isActing || v.status === s || v.status !== 'PENDING'} onClick={() => handleVerificationAction(v.id, s as any)} className={`rounded-xl px-4 py-2 text-[10px] font-black uppercase tracking-[0.2em] transition-all ${v.status === s ? 'bg-primary text-white' : 'bg-white border border-surface-border text-text-muted hover:border-primary hover:text-primary'}`}>{s}</button>))}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : null}

          {activeTab === 'disputes' ? (
            <div className="space-y-6">
              {disputes.length === 0 ? <p className="text-sm font-semibold text-text-light">No disputes opened yet.</p> : disputes.map((d) => {
                const creatorName = d.creator.employerProfile?.companyName || getDisplayName(d.creator.jobSeekerProfile?.firstName || d.creator.freelancerProfile?.firstName, d.creator.jobSeekerProfile?.lastName || d.creator.freelancerProfile?.lastName, d.creator.email)
                const cpName = d.counterparty?.employerProfile?.companyName || getDisplayName(d.counterparty?.jobSeekerProfile?.firstName || d.counterparty?.freelancerProfile?.firstName, d.counterparty?.jobSeekerProfile?.lastName || d.counterparty?.freelancerProfile?.lastName, d.counterparty?.email || 'Unknown')
                return (
                  <div key={d.id} className="rounded-3xl border border-surface-border bg-surface-alt/20 p-6">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-text-light mb-2">{d.type} / {d.agreement.type} / {formatRelativeTime(d.createdAt)}</p>
                        <p className="text-xl font-black text-text-main">{d.title}</p>
                        <p className="text-sm font-bold text-text-muted">Agreement: {d.agreement.title}</p>
                        <p className="mt-2 text-[10px] font-black uppercase tracking-[0.2em] text-text-light">Opened by {creatorName} / Counterparty {cpName}</p>
                        <p className="mt-4 text-sm text-text-main leading-relaxed whitespace-pre-wrap">{d.description}</p>
                        {d.evidenceUrl ? <a href={d.evidenceUrl} target="_blank" rel="noreferrer" className="mt-4 inline-flex text-[10px] font-black uppercase tracking-[0.2em] text-primary hover:underline">Open evidence</a> : null}
                        {d.resolutionNote ? <p className="mt-4 rounded-2xl border border-surface-border bg-white px-4 py-3 text-xs font-semibold text-text-muted">Resolution note: {d.resolutionNote}</p> : null}
                      </div>
                      <div className="flex flex-wrap items-center gap-3">
                        <span className={`badge ${d.status === 'RESOLVED' ? 'bg-success text-white' : d.status === 'DISMISSED' ? 'bg-surface-alt text-text-main' : d.status === 'UNDER_REVIEW' ? 'bg-secondary text-white' : 'bg-error text-white'}`}>{d.status}</span>
                        {disputeStatuses.map((s) => (<button key={s} type="button" disabled={isActing || d.status === s || ['RESOLVED', 'DISMISSED'].includes(d.status)} onClick={() => handleAction(() => apiUpdateAdminDisputeStatus(d.id, s as any))} className={`rounded-xl px-4 py-2 text-[10px] font-black uppercase tracking-[0.2em] transition-all ${d.status === s ? 'bg-primary text-white' : 'bg-white border border-surface-border text-text-muted hover:border-primary hover:text-primary'}`}>{s}</button>))}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : null}
        </div>
      )}
    </div>
  )
}
