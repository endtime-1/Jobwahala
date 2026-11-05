import { Link } from 'react-router-dom'
import SEO from '../components/SEO'

export default function AccountDeleted() {
  return (
    <div className="container max-w-xl pb-16 pt-[calc(env(safe-area-inset-top)+9rem)] text-center">
      <SEO title="Account deleted" description="Your JobWahala account has been deleted." />
      <h1 className="text-3xl font-black tracking-tight text-text-main">Your account has been deleted</h1>
      <p className="mt-3 text-base font-medium leading-relaxed text-text-muted">
        We have removed your personal details and signed you out. Thank you for being part of JobWahala. You are always welcome back.
      </p>
      <Link to="/" className="btn btn-primary mt-6 inline-flex">
        Back to the home page
      </Link>
    </div>
  )
}
