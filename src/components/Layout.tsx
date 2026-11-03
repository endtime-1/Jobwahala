import { Outlet, useLocation } from 'react-router-dom'
import Navbar from './Navbar'
import Footer from './Footer'

export default function Layout() {
  // The home page keeps its own design; every other page uses the flatter "v2" look.
  const isHome = useLocation().pathname === '/'

  return (
    <div className={`relative min-h-screen overflow-x-clip ${isHome ? '' : 'v2'}`}>
      <div className={`pointer-events-none fixed inset-0 -z-10 ${isHome ? '' : 'hidden'}`}>
        <div className="absolute inset-x-0 top-0 h-[28rem] bg-[radial-gradient(circle_at_top_left,_rgba(255,122,69,0.16),_transparent_38%),radial-gradient(circle_at_top_right,_rgba(47,109,246,0.16),_transparent_32%)]" />
        <div className="absolute inset-x-0 top-40 h-[32rem] bg-[radial-gradient(circle_at_center,_rgba(16,26,43,0.05),_transparent_60%)]" />
        <div className="absolute inset-0 opacity-40 [background-image:linear-gradient(rgba(135,150,170,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(135,150,170,0.06)_1px,transparent_1px)] [background-size:36px_36px]" />
      </div>

      <div className="relative z-10 flex min-h-screen flex-col">
        <Navbar />
        <main className="relative flex-grow pb-[calc(env(safe-area-inset-bottom)+6.75rem)] xl:pb-0">
          <Outlet />
        </main>
        <div className="hidden xl:block">
          <Footer />
        </div>
      </div>
    </div>
  )
}
