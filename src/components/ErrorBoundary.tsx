import { Component, type ErrorInfo, type ReactNode } from 'react'
import { reportError } from '../lib/errorReporting'

type Props = { children: ReactNode }
type State = { failed: boolean }

/** Catches a crash while drawing the page, reports it (scrubbed), and shows a plain way out instead of a blank screen. */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { failed: false }

  static getDerivedStateFromError(): State {
    return { failed: true }
  }

  componentDidCatch(error: Error, _info: ErrorInfo) {
    reportError(error)
  }

  render() {
    if (!this.state.failed) return this.props.children

    // Plain links, not router links: the router may be what broke.
    return (
      <div role="alert" className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6 text-center">
        <h1 className="text-2xl font-black text-text-main">Something went wrong</h1>
        <p className="mt-2 text-base font-medium text-text-muted">
          We have been told about it. Please reload the page. If it keeps happening, try again in a few minutes.
        </p>
        <div className="mt-6 flex gap-3">
          <button type="button" onClick={() => window.location.reload()} className="btn btn-primary">
            Reload the page
          </button>
          <a href="/" className="btn btn-outline">
            Go to the home page
          </a>
        </div>
      </div>
    )
  }
}
