import { Suspense, lazy, type ReactElement } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import ApiStatusBanner from './components/ApiStatusBanner'
import Layout from './components/Layout'
import Landing from './pages/Landing'
import { useAuth } from './context/AuthContext'
import { useFeatures } from './lib/features'

const JobListings = lazy(() => import('./pages/JobListings'))
const JobDetails = lazy(() => import('./pages/JobDetails'))
const Internships = lazy(() => import('./pages/Internships'))
const SearchLanding = lazy(() => import('./pages/SearchLanding'))
const CVGenerator = lazy(() => import('./pages/CVGenerator'))
const Messaging = lazy(() => import('./pages/Messaging'))
const MyApplications = lazy(() => import('./pages/MyApplications'))
const AccountSettings = lazy(() => import('./pages/AccountSettings'))
const SavedJobs = lazy(() => import('./pages/SavedJobs'))
const AccountDeleted = lazy(() => import('./pages/AccountDeleted'))
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
const BlogPost = lazy(() => import('./pages/BlogPost'))
const Support = lazy(() => import('./pages/Support'))
const IdentityVerification = lazy(() => import('./pages/IdentityVerification'))
const Terms = lazy(() => import('./pages/Terms'))
const Privacy = lazy(() => import('./pages/Privacy'))
const CompanyProfile = lazy(() => import('./pages/CompanyProfile'))
const NotFound = lazy(() => import('./pages/NotFound'))

function RouteFallback() {
  return (
    <div className="min-h-[40vh] flex items-center justify-center bg-white text-text-main">
      <p className="text-xs font-black uppercase tracking-[0.3em] text-text-light">Loading Page</p>
    </div>
  )
}

// Freelance pages only exist while FREELANCE_ENABLED is on; otherwise visitors land on the waitlist.
function FreelanceGate({ children }: { children: ReactElement }) {
  const { loaded, freelanceEnabled } = useFeatures()
  if (!loaded) return <RouteFallback />
  return freelanceEnabled ? children : <Navigate to="/#freelance-gigs" replace />
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
          <Route path="/jobs-in/:country" element={<JobListings />} />
          <Route path="/internships" element={<Internships />} />
          <Route path="/jobs/:id" element={<JobDetails />} />
          <Route path="/cv-generator" element={renderProtected(<CVGenerator />)} />
          <Route path="/messaging" element={renderProtected(<Messaging />)} />
          <Route path="/applications" element={renderProtected(<MyApplications />)} />
          <Route path="/saved-jobs" element={renderProtected(<SavedJobs />)} />
          <Route path="/settings" element={renderProtected(<AccountSettings />)} />
          <Route path="/account-deleted" element={<AccountDeleted />} />
          <Route path="/agreements" element={<FreelanceGate>{renderProtected(<Agreements />)}</FreelanceGate>} />
          <Route path="/proposals" element={<FreelanceGate>{renderProtected(<Proposals />)}</FreelanceGate>} />
          <Route path="/dashboard" element={renderProtected(<Dashboard />)} />
          <Route path="/freelancers" element={<FreelanceGate><FreelancerMarketplace /></FreelanceGate>} />
          <Route path="/freelancers/:id" element={<FreelanceGate><FreelancerProfile /></FreelanceGate>} />
          <Route path="/companies/:id" element={<CompanyProfile />} />
          <Route path="/blog" element={<Blog />} />
          <Route path="/blog/:id" element={<BlogPost />} />
          <Route path="/support" element={<Support />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/verify-identity" element={renderProtected(<IdentityVerification />)} />
          {/* Search landing pages: /jobs-in-accra, /banking-jobs, /banking-jobs-in-accra, /jobs-by-location */}
          <Route path="/:slug" element={<SearchLanding />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </Suspense>
  )
}

export default App
