import { Printer } from 'lucide-react'
import QrCode from '../components/QrCode'
import SEO from '../components/SEO'
import Logo from '../components/Logo'
import { SITE_URL } from '../content/social'
import { whatsappChannelUrl } from '../lib/whatsapp'
import { whatsappContactLink } from '../lib/flyer'

/**
 * A one-page flyer for employers, ready to print or save as a PDF from the browser (Ctrl+P). Two QR codes: one to post a job, one to
 * reach JobWahala on WhatsApp. If the WhatsApp number has not been set (VITE_WHATSAPP_CONTACT_NUMBER), the second code opens the
 * WhatsApp channel instead, so the flyer is never missing a code.
 */
export default function EmployerFlyer() {
  const postUrl = `${SITE_URL}/signup?role=employer&utm_source=flyer&utm_medium=print&utm_campaign=employer_flyer`
  const chat = whatsappContactLink(import.meta.env.VITE_WHATSAPP_CONTACT_NUMBER)
  const whatsappUrl = chat ?? whatsappChannelUrl()
  const whatsappLabel = chat ? 'Message us on WhatsApp' : 'Follow our WhatsApp channel'

  return (
    <div className="flyer-screen min-h-screen bg-surface-alt/40 py-8 print:bg-white print:py-0">
      <SEO title="Employer flyer" noindex />
      <style>{`@page { size: A4; margin: 0 } @media print { .flyer-screen { background: #fff !important } .no-print { display: none !important } .flyer-page { box-shadow: none !important; margin: 0 !important } }`}</style>

      <div className="no-print mx-auto mb-6 flex max-w-[794px] items-center justify-between gap-4 px-4">
        <p className="text-sm font-semibold text-text-muted">Print this page, or choose &quot;Save as PDF&quot; in the print window. It fits one A4 page.</p>
        <button type="button" onClick={() => window.print()} className="btn btn-primary btn-sm shrink-0">
          <Printer className="h-4 w-4" aria-hidden /> Print
        </button>
      </div>

      <article aria-label="JobWahala employer flyer" className="flyer-page mx-auto flex w-full max-w-[794px] flex-col overflow-hidden bg-white text-[#101a2b] shadow-premium" style={{ minHeight: 1123 }}>
        <header className="px-10 pb-10 pt-12 text-white" style={{ background: 'linear-gradient(135deg,#14306b 0%,#2f6df6 100%)' }}>
          <Logo tone="dark" size={44} />
          <h1 className="mt-10 text-5xl font-black leading-[1.05] tracking-tight">
            Hiring? <span className="text-gold">Post your job free.</span>
          </h1>
          <p className="mt-4 max-w-xl text-xl font-semibold text-white/85">Real jobs from employers you can check. Reach people looking for work across Ghana and Africa.</p>
        </header>

        <section className="px-10 py-9">
          <ul className="space-y-4 text-xl font-bold">
            <li>✔ Posting a job is free</li>
            <li>✔ See every applicant and their CV in one place</li>
            <li>✔ Get a verified badge so people trust your job</li>
            <li>✔ Weekly report: how many people saw and applied to each job</li>
          </ul>
        </section>

        <section className="mt-auto grid grid-cols-2 gap-6 px-10 pb-10">
          <div className="rounded-3xl border-2 border-[#2f6df6] p-6 text-center">
            <QrCode value={postUrl} label="Scan to post a job on JobWahala" size={210} className="mx-auto" />
            <p className="mt-4 text-2xl font-black text-[#14306b]">Scan to post a job</p>
            <p className="mt-1 text-sm font-semibold text-[#536275]">jobwahala.com</p>
          </div>
          <div className="rounded-3xl border-2 border-[#25d366] p-6 text-center">
            <QrCode value={whatsappUrl} label={whatsappLabel} size={210} className="mx-auto" />
            <p className="mt-4 text-2xl font-black text-[#128c4a]">{whatsappLabel}</p>
            <p className="mt-1 text-sm font-semibold text-[#536275]">Send us your vacancy. We can post it for you.</p>
          </div>
        </section>

        <footer className="bg-[#101a2b] px-10 py-5 text-center text-sm font-semibold text-white/80">www.jobwahala.com · Work without the wahala.</footer>
      </article>
    </div>
  )
}
