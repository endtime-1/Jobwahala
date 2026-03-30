import { Suspense, lazy } from 'react'
import { useAuth } from '../context/AuthContext'

const SeekerDashboard = lazy(() => import('./dashboards/SeekerDashboard'))
const EmployerDashboard = lazy(() => import('./dashboards/EmployerDashboard'))
const FreelancerDashboard = lazy(() => import('./dashboards/FreelancerDashboard'))
const AdminDashboard = lazy(() => import('./dashboards/AdminDashboard'))

function DashboardFallback() {
  return (
    <div className="card bg-white border-surface-border p-10">
      <p className="text-sm font-black uppercase tracking-[0.2em] text-text-light">Loading dashboard...</p>
    </div>
  )
}

export default function Dashboard() {
  const { role } = useAuth()

  return (
    <div className="container pt-[calc(env(safe-area-inset-top)+7.25rem)] pb-8 md:pt-[calc(env(safe-area-inset-top)+7.75rem)] md:pb-12 xl:pt-[calc(env(safe-area-inset-top)+8.5rem)]">
      <Suspense fallback={<DashboardFallback />}>
        {role === 'SEEKER' && <SeekerDashboard />}
        {role === 'EMPLOYER' && <EmployerDashboard />}
        {role === 'FREELANCER' && <FreelancerDashboard />}
        {role === 'ADMIN' && <AdminDashboard />}
      </Suspense>
    </div>
  )
}
