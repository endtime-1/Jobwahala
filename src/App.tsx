import ScrollToTop from './components/ScrollToTop'
import { Suspense, lazy, type ReactElement } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import ApiStatusBanner from './components/ApiStatusBanner'
import Layout from './components/Layout'
import Landing from './pages/Landing'
import { useAuth } from './context/AuthContext'
import { useFeatures } from './lib/features'

const JobListings = lazy(() => import('./pages/JobListings'))
const JobDetails = lazy(() => import('./pages/JobDetails'))
const Internships = lazy(() => import('./pages/Internships'))
const Courses = lazy(() => import('./pages/Courses'))
const Billing = lazy(() => import('./pages/Billing'))
const Plans = lazy(() => import('./pages/Plans'))
const Team = lazy(() => import('./pages/Team'))
const JoinTeam = lazy(() => import('./pages/JoinTeam'))
const CvDatabase = lazy(() => import('./pages/CvDatabase'))
const HiringReports = lazy(() => import('./pages/HiringReports'))
const CompanyPageEditor = lazy(() => import('./pages/CompanyPageEditor'))
const CourseDetail = lazy(() => import('./pages/CourseDetail'))
const ProviderPage = lazy(() => import('./pages/ProviderPage'))
const ProviderDashboard = lazy(() => import('./pages/ProviderDashboard'))
const SlugPage = lazy(() => import('./pages/SlugPage'))
const CourseCategoryPage = lazy(() => import('./pages/SlugPage').then((module) => ({ default: module.CourseCategoryPage })))
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
const About = lazy(() => import('./pages/About'))
const HiringService = lazy(() => import('./pages/HiringService'))
const HiringRequestPage = lazy(() => import('./pages/HiringRequest'))
const HiringRequestForm = lazy(() => import('./pages/HiringRequestForm'))
const Opportunities = lazy(() => import('./pages/Opportunities'))
const RecruiterRequest = lazy(() => import('./pages/RecruiterRequest'))
const ClaimCompany = lazy(() => import('./pages/ClaimCompany'))
const EmployerFlyer = lazy(() => import('./pages/EmployerFlyer'))
const Terms = lazy(() => import('./pages/Terms'))
const Privacy = lazy(() => import('./pages/Privacy'))
const CompanyProfile = lazy(() => import('./pages/CompanyProfile'))
const NotFound = lazy(() => import('./pages/NotFound'))

/**
 * Links such as /onboarding?role=employer are meant for people who have no account yet: they go to sign up, with the account type and any
 * referral code kept. A link with nothing to keep goes to log in, as before.
 */
function LoggedOutOnboarding() {
  const { search } = useLocation()
  const params = new URLSearchParams(search)
  return <Navigate to={params.has('role') || params.has('ref') ? `/signup${search}` : '/login'} replace />
}

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
  // Pages for people looking for work. An employer has their own workspace instead, so they are sent to their dashboard.
  const seekerSide = (element: ReactElement) => (user?.role === 'EMPLOYER' ? <Navigate to="/dashboard" replace /> : element)

  // Pages that only make sense for an employer. Anyone else goes to their own dashboard instead of seeing "access denied".
  const employerSide = (element: ReactElement) => (user && user.role !== 'EMPLOYER' ? <Navigate to="/dashboard" replace /> : element)

  const renderProtected = (element: ReactElement) => {
    if (!user) return <Navigate to="/login" replace />
    if (!isOnboarded) return <Navigate to="/onboarding" replace />
    return element
  }

  return (
    <Suspense fallback={<RouteFallback />}>
      <ScrollToTop />
      <ApiStatusBanner />
      <Routes>
        <Route path="/login" element={user ? <Navigate to={authRedirect} replace /> : <Login />} />
        <Route path="/signup" element={user ? <Navigate to={authRedirect} replace /> : <Signup />} />
        <Route path="/verify-email" element={<VerifyEmail />} />
        <Route path="/employer-flyer" element={<EmployerFlyer />} />
        <Route path="/forgot-password" element={user ? <Navigate to={authRedirect} replace /> : <ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route
          path="/onboarding"
          element={!user ? <LoggedOutOnboarding /> : isOnboarded ? <Navigate to="/dashboard" replace /> : <Onboarding />}
        />

        <Route element={<Layout />}>
          <Route path="/" element={<Landing />} />
          <Route path="/jobs" element={seekerSide(<JobListings />)} />
          <Route path="/jobs-in/:country" element={<JobListings />} />
          <Route path="/internships" element={seekerSide(<Internships />)} />
          <Route path="/courses" element={seekerSide(<Courses />)} />
          <Route path="/courses/category/:category" element={seekerSide(<CourseCategoryPage />)} />
          <Route path="/courses/:slug" element={<CourseDetail />} />
          <Route path="/providers/:id" element={<ProviderPage />} />
          <Route path="/provider" element={renderProtected(<ProviderDashboard />)} />
          <Route path="/billing" element={renderProtected(<Billing />)} />
          <Route path="/plans" element={renderProtected(employerSide(<Plans />))} />
          <Route path="/team" element={renderProtected(employerSide(<Team />))} />
          <Route path="/join-team" element={renderProtected(<JoinTeam />)} />
          <Route path="/cv-database" element={renderProtected(employerSide(<CvDatabase />))} />
          <Route path="/hiring-reports" element={renderProtected(employerSide(<HiringReports />))} />
          <Route path="/company-page" element={renderProtected(employerSide(<CompanyPageEditor />))} />
          <Route path="/jobs/:id" element={<JobDetails />} />
          <Route path="/cv-generator" element={renderProtected(seekerSide(<CVGenerator />))} />
          <Route path="/messaging" element={renderProtected(<Messaging />)} />
          <Route path="/applications" element={renderProtected(seekerSide(<MyApplications />))} />
          <Route path="/saved-jobs" element={renderProtected(seekerSide(<SavedJobs />))} />
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
          <Route path="/about" element={<About />} />
          <Route path="/hiring-service" element={<HiringService />} />
          <Route path="/hiring-service/new" element={renderProtected(<HiringRequestForm />)} />
          <Route path="/hiring-service/:id" element={renderProtected(<HiringRequestPage />)} />
          <Route path="/opportunities" element={renderProtected(<Opportunities />)} />
          <Route path="/recruiter/requests/:id" element={renderProtected(<RecruiterRequest />)} />
          <Route path="/claim/:token" element={<ClaimCompany />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/verify-identity" element={renderProtected(<IdentityVerification />)} />
          {/* Search landing pages: /jobs-in-accra, /banking-jobs, /banking-jobs-in-accra, /jobs-by-location */}
          <Route path="/:slug" element={<SlugPage />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </Suspense>
  )
}

export default App
