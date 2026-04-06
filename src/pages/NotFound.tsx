import { Link } from 'react-router-dom'
import { ArrowLeft, Compass } from 'lucide-react'
import SEO from '../components/SEO'

export default function NotFound() {
  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4 fade-in">
      <SEO
        title="Page Not Found — JobWahala"
        description="The page you're looking for doesn't exist. Navigate back to the JobWahala workspace."
      />
      <div className="text-center max-w-lg">
        {/* Animated icon */}
        <div className="relative mx-auto mb-10 h-28 w-28">
          <div className="absolute inset-0 rounded-[2rem] bg-primary/10 animate-pulse" />
          <div className="absolute inset-0 flex items-center justify-center">
            <Compass className="h-14 w-14 text-primary animate-[spin_8s_linear_infinite]" />
          </div>
        </div>

        {/* Title & Description */}
        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-primary mb-4">
          404 — Page Not Found
        </p>
        <h1 className="text-4xl md:text-5xl font-black tracking-tighter text-text-main mb-6 leading-tight">
          This page doesn't <br />
          <span className="text-primary italic">exist yet.</span>
        </h1>
        <p className="text-text-muted text-lg leading-relaxed mb-10 max-w-md mx-auto">
          You may have followed an outdated link, or the page has been moved. 
          Let's get you back on track.
        </p>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            to="/"
            className="btn btn-primary btn-lg px-8 flex items-center gap-2"
          >
            <ArrowLeft className="h-5 w-5" />
            Back to Home
          </Link>
          <Link
            to="/jobs"
            className="btn btn-outline btn-lg px-8"
          >
            Browse Jobs
          </Link>
        </div>
      </div>
    </div>
  )
}
