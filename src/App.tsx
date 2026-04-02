import { Suspense, lazy, type ReactElement } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import ApiStatusBanner from './components/ApiStatusBanner'
import Layout from './components/Layout'
import { useAuth } from './context/AuthContext'

const Landing = lazy(() => import('./pages/Landing'))
const JobListings = lazy(() => import('./pages/JobListings'))
const JobDetails = lazy(() => import('./pages/JobDetails'))
const CVGenerator = lazy(() => import('./pages/CVGenerator'))
const Messaging = lazy(() => import('./pages/Messaging'))
const Dashboard = lazy(() => import('./pages/Dashboard'))
const Agreements = lazy(() => import('./pages/Agreements'))
const Proposals = lazy(() => import('./pages/Proposals'))
const Onboarding = lazy(() => import('./pages/Onboarding'))
const Login = lazy(() => import('./pages/Login'))
const Signup = lazy(() => import('./pages/Signup'))
const FreelancerMarketplace = lazy(() => import('./pages/FreelancerMarketplace'))
const FreelancerProfile = lazy(() => import('./pages/FreelancerProfile'))
const VerifyEmail = lazy(() => import('./pages/VerifyEmail'))
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'))
const ResetPassword = lazy(() => import('./pages/ResetPassword'))
const Blog = lazy(() => import('./pages/Blog'))

function RouteFallback() {
  return (
    <div className="min-h-[40vh] flex items-center justify-center bg-white text-text-main">
      <p className="text-xs font-black uppercase tracking-[0.3em] text-text-light">Loading Page</p>
    </div>
  )
}

function App() {
  const { user, isLoading, isOnboarded } = useAuth()

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white text-text-main">
        <div className="text-center">
          <p className="text-xs font-black uppercase tracking-[0.3em] text-text-light">Loading Workspace</p>
        </div>
      </div>
    )
  }

  const authRedirect = user ? (isOnboarded ? '/dashboard' : '/onboarding') : '/login'
  const renderProtected = (element: ReactElement) => {
    if (!user) return <Navigate to="/login" replace />
    if (!isOnboarded) return <Navigate to="/onboarding" replace />
    return element
  }

  return (
    <Suspense fallback={<RouteFallback />}>
      <ApiStatusBanner />
      <Routes>
        <Route path="/login" element={user ? <Navigate to={authRedirect} replace /> : <Login />} />
        <Route path="/signup" element={user ? <Navigate to={authRedirect} replace /> : <Signup />} />
        <Route path="/verify-email" element={<VerifyEmail />} />
        <Route path="/forgot-password" element={user ? <Navigate to={authRedirect} replace /> : <ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route
          path="/onboarding"
          element={!user ? <Navigate to="/login" replace /> : isOnboarded ? <Navigate to="/dashboard" replace /> : <Onboarding />}
        />

        <Route element={<Layout />}>
          <Route path="/" element={<Landing />} />
          <Route path="/jobs" element={<JobListings />} />
          <Route path="/jobs/:id" element={<JobDetails />} />
          <Route path="/cv-generator" element={renderProtected(<CVGenerator />)} />
          <Route path="/messaging" element={renderProtected(<Messaging />)} />
          <Route path="/agreements" element={renderProtected(<Agreements />)} />
          <Route path="/proposals" element={renderProtected(<Proposals />)} />
          <Route path="/dashboard" element={renderProtected(<Dashboard />)} />
          <Route path="/freelancers" element={<FreelancerMarketplace />} />
          <Route path="/freelancers/:id" element={<FreelancerProfile />} />
          <Route path="/blog" element={<Blog />} />
        </Route>
      </Routes>
    </Suspense>
  )
}

export default App
