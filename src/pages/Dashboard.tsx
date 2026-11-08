import { Suspense, lazy } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useFeatures } from '../lib/features'

const SeekerDashboard = lazy(() => import('./dashboards/SeekerDashboard'))
const EmployerDashboard = lazy(() => import('./dashboards/EmployerDashboard'))
const FreelancerDashboard = lazy(() => import('./dashboards/FreelancerDashboard'))
const AdminDashboard = lazy(() => import('./dashboards/AdminDashboard'))
const RecruiterDashboard = lazy(() => import('./dashboards/RecruiterDashboard'))

function DashboardFallback() {
  return (
    <div className="card bg-white border-surface-border p-10">
      <p className="text-sm font-black uppercase tracking-[0.2em] text-text-light">Loading dashboard...</p>
    </div>
  )
}

export default function Dashboard() {
  const { role } = useAuth()
  const { freelanceEnabled } = useFeatures()

  return (
    <div className="container pt-[calc(env(safe-area-inset-top)+8rem)] pb-8 md:pt-[calc(env(safe-area-inset-top)+8rem)] md:pb-12 xl:pt-[calc(env(safe-area-inset-top)+9rem)]">
      <Suspense fallback={<DashboardFallback />}>
        {role === 'SEEKER' && <SeekerDashboard />}
        {role === 'EMPLOYER' && <EmployerDashboard />}
        {role === 'FREELANCER' && freelanceEnabled && <FreelancerDashboard />}
        {role === 'FREELANCER' && !freelanceEnabled && (
          <div className="card border-surface-border bg-white p-8">
            <h1 className="text-2xl font-black text-text-main">Freelance gigs are coming soon</h1>
            <p className="mt-2 max-w-xl text-base font-medium text-text-muted">
              We are starting with jobs. Your account is saved, and we will tell you when freelance gigs open.
            </p>
            <Link to="/jobs" className="btn btn-primary mt-5 inline-flex">Browse jobs</Link>
          </div>
        )}
        {role === 'ADMIN' && <AdminDashboard />}
        {role === 'RECRUITER' && <RecruiterDashboard />}
      </Suspense>
    </div>
  )
}
