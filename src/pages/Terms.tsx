import { Link } from 'react-router-dom'
import LegalPage from '../components/LegalPage'

// DRAFT. Describes how the product works today (jobs first; freelance gigs, payments and escrow come
// later). Not reviewed by a lawyer. Items in [square brackets] are for the company and its lawyer to complete.

export default function Terms() {
  return (
    <LegalPage
      title="Terms of Service"
      description="The rules for using JobWahala as a job seeker or an employer. Draft, for legal review."
      updated="5 November 2026 (draft)"
      draftNotice={
        <p>
          These terms are a draft. They have not been reviewed by a lawyer and are not yet final. Text in [square brackets] must be completed or
          confirmed before launch. They are not legal advice.
        </p>
      }
      intro="These terms govern your use of JobWahala. By creating an account you agree to them. If you do not agree, please do not use the platform."
      sections={[
        {
          heading: 'Who we are, and what JobWahala is',
          body: (
            <p>
              JobWahala is operated by [LEGAL NAME OF THE COMPANY], [REGISTERED ADDRESS], Ghana. It is an online job portal that connects people who are
              looking for work with employers. We are not an employer or a recruitment agent for the jobs posted, and we are not a party to any
              employment that results.
            </p>
          ),
        },
        {
          heading: 'Your account',
          body: (
            <>
              <p>
                You must be at least [18] years old and give accurate information. You can sign up with an email address and password, or with a Ghana
                mobile number confirmed by a one-time code that we send by text message. Keep your login details secure; you are responsible for
                activity on your account.
              </p>
              <p>You can register as a job seeker or an employer. Administrator accounts are created by JobWahala only.</p>
            </>
          ),
        },
        {
          heading: 'Freelance gigs, payments and escrow (not available yet)',
          body: (
            <p>
              Freelance gigs, proposals, agreements, escrow and payouts are planned but not open. Nothing on JobWahala today involves us holding or
              paying out money for you. When these features launch we will publish the terms that apply to them here before you can use them.
            </p>
          ),
        },
        {
          heading: 'Jobs and applications',
          body: (
            <>
              <p>
                Employers are responsible for the accuracy and lawfulness of the jobs they post. A job stays open until its closing date (at most 90 days), and
                employers can edit, pause, extend or close it. Job seekers are responsible for the accuracy of their applications.
              </p>
              <p>You must never be asked to pay to apply for a job. Report any job that asks you to.</p>
            </>
          ),
        },
        {
          heading: 'Employer verification',
          body: (
            <p>
              Employers can ask to be verified by giving their Registrar-General registration number, certificate, address and a contact we confirm with a
              code. Our team reviews each request and records the decision and the reason. A &quot;Verified employer&quot; badge means we checked those
              documents at the time; it is not a guarantee of any job or of the employer&apos;s conduct. Providing false documents will lead to removal and
              may be reported to the authorities.
            </p>
          ),
        },
        {
          heading: 'Acceptable use',
          body: (
            <>
              <p>
                Do not post unlawful, misleading or discriminatory content, impersonate anyone, harass other users, scrape the platform, send spam,
                try to get around bot checks, rate limits or other security, or use the platform for anything illegal.
              </p>
              <p>You can report jobs, companies or users. Our team may flag, suspend or remove content and accounts that break these terms.</p>
            </>
          ),
        },
        {
          heading: 'Your data and your content',
          body: (
            <p>
              You keep ownership of what you post. You give us permission to store and show it as needed to run the service. How we handle personal data is
              described in our{' '}
              <Link to="/privacy" className="font-bold text-primary hover:underline">
                Privacy Policy
              </Link>
              , which follows Ghana&apos;s Data Protection Act, 2012 (Act 843). You can download your data and delete your account at any time in{' '}
              <Link to="/settings" className="font-bold text-primary hover:underline">
                Account settings
              </Link>
              .
            </p>
          ),
        },
        {
          heading: 'Ending your account',
          body: (
            <p>
              You can delete your account yourself. Some things must be finished first, such as active work agreements, and an employer&apos;s open jobs are
              closed. We may suspend or end an account that breaks these terms, and will tell you why where we can.
            </p>
          ),
        },
        {
          heading: 'Liability',
          body: (
            <p>
              JobWahala is provided as available. To the extent the law allows, we are not liable for indirect losses, for the conduct of users, or for
              the accuracy of jobs. Nothing here limits rights you have under Ghanaian consumer law. [Lawyer to confirm limits of liability.]
            </p>
          ),
        },
        {
          heading: 'Governing law and disputes',
          body: <p>These terms are governed by the laws of Ghana. [Lawyer to confirm the courts, and whether to offer mediation or arbitration first.]</p>,
        },
        {
          heading: 'Changes',
          body: <p>We may update these terms. Material changes will be announced in the app, and continuing to use JobWahala after a change means you accept it.</p>,
        },
      ]}
    />
  )
}
