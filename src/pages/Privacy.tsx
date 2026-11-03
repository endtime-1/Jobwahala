import LegalPage from '../components/LegalPage'

export default function Privacy() {
  return (
    <LegalPage
      title="Privacy Policy"
      description="What personal data JobWahala collects, why, and the choices you have."
      updated="3 November 2026"
      intro="This policy explains what we collect when you use JobWahala, how we use it, and your choices."
      sections={[
        {
          heading: 'What we collect',
          body: (
            <ul className="list-disc space-y-1 pl-5">
              <li>Account details: email address, password (stored hashed) and role.</li>
              <li>Profile content: name, skills, experience, company details, CVs you generate and services you list.</li>
              <li>Activity: applications, proposals, agreements, messages, reviews and reports.</li>
              <li>Verification evidence you choose to upload.</li>
              <li>Payment and payout details processed by our payment provider. We do not store full card numbers.</li>
            </ul>
          ),
        },
        {
          heading: 'How we use it',
          body: (
            <p>
              To run the marketplace: show your profile to the right people, match you with jobs and talent, process payments, send notifications and
              security emails, prevent fraud and handle disputes and reports.
            </p>
          ),
        },
        {
          heading: 'AI features',
          body: (
            <p>
              CV generation, proposal drafting and match coaching send the text you provide to an AI service to produce a draft. Do not include information
              you are not comfortable sharing for that purpose.
            </p>
          ),
        },
        {
          heading: 'Who we share it with',
          body: (
            <p>
              Other users see what you choose to publish and what is needed to work together on an agreement. Service providers such as payment, email,
              hosting and identity-verification partners process data on our behalf. We do not sell personal data.
            </p>
          ),
        },
        {
          heading: 'Retention and security',
          body: (
            <p>
              We keep data while your account is active and as needed for payments, disputes and legal obligations. Traffic is encrypted in transit. Evidence
              files are stored under private, unguessable addresses and are only shown to the people involved and administrators.
            </p>
          ),
        },
        {
          heading: 'Your choices',
          body: (
            <p>
              You can update your profile at any time, and you can ask us to correct or delete your account data through the Support centre. Some records,
              such as completed payments, may need to be retained.
            </p>
          ),
        },
        {
          heading: 'Cookies and local storage',
          body: <p>We store a sign-in token and a few preferences in your browser so you stay logged in. We do not use it for advertising.</p>,
        },
      ]}
    />
  )
}
