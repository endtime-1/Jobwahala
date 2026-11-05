import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import App from './App'
import './index.css'
import { AuthProvider } from './context/AuthContext'
import { SocketProvider } from './context/SocketContext'
import { queryClient } from './lib/queryClient'
import { installStaleAppRecovery } from './lib/staleAppRecovery'
import ErrorBoundary from './components/ErrorBoundary'
import { installEarlyErrorCapture, startErrorReporting } from './lib/errorReporting'

import { HelmetProvider } from 'react-helmet-async'

installStaleAppRecovery()
installEarlyErrorCapture()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
    <HelmetProvider>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <AuthProvider>
            <SocketProvider>
              <App />
            </SocketProvider>
          </AuthProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </HelmetProvider>
    </ErrorBoundary>
  </React.StrictMode>,
)

// Error reporting loads after the page is up and the browser is idle, so it never slows the first screen.
const startReportingWhenIdle = () => {
  const start = () => void startErrorReporting().catch(() => undefined)
  // Older phones do not have requestIdleCallback; a short delay does the same job.
  if (typeof window.requestIdleCallback === 'function') window.requestIdleCallback(start)
  else globalThis.setTimeout(start, 2000)
}
if (document.readyState === 'complete') startReportingWhenIdle()
else window.addEventListener('load', startReportingWhenIdle, { once: true })

