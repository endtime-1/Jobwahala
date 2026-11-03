import LegalPage from '../components/LegalPage'

export default function Terms() {
  return (
    <LegalPage
      title="Terms of Service"
      description="The rules for using JobWahala as a job seeker, freelancer or employer."
      updated="3 November 2026"
      intro="These terms govern your use of JobWahala. By creating an account you agree to them. If you do not agree, please do not use the platform."
      sections={[
        {
          heading: 'Your account',
          body: (
            <>
              <p>You must provide accurate information and keep your login details secure. You are responsible for activity on your account.</p>
              <p>You may register as a job seeker, freelancer or employer. Admin accounts are created by JobWahala only.</p>
            </>
          ),
        },
        {
          heading: 'Jobs, services and proposals',
          body: (
            <p>
              Employers and freelancers are responsible for the accuracy of what they post. A proposal, once accepted by both sides, becomes an agreement that
              describes the scope, amount and milestones. JobWahala is a marketplace and is not a party to the work itself.
            </p>
          ),
        },
        {
          heading: 'Payments and escrow',
          body: (
            <>
              <p>
                Milestone payments are collected through our payment provider and held until the milestone is approved. Approved funds are paid out to the
                provider payout account, after any platform fee shown at checkout and any hold period that applies.
              </p>
              <p>You agree not to take agreed payments outside the platform in order to avoid fees.</p>
            </>
          ),
        },
        {
          heading: 'Identity and verification',
          body: (
            <p>
              Some features need identity, business or professional verification. Evidence you submit is used only to review your request. Providing false
              documents will lead to removal.
            </p>
          ),
        },
        {
          heading: 'Acceptable use',
          body: (
            <>
              <p>Do not post unlawful, misleading or discriminatory content, harass other users, scrape the platform, or attempt to bypass security or rate limits.</p>
              <p>You can report jobs, services or users. Our team may flag, suspend or remove content and accounts that break these terms.</p>
            </>
          ),
        },
        {
          heading: 'Disputes',
          body: (
            <p>
              If an agreement goes wrong, either party can open a dispute from the agreement. Both sides can add messages and evidence, and a JobWahala
              administrator will review and record a resolution.
            </p>
          ),
        },
        {
          heading: 'Liability',
          body: (
            <p>
              JobWahala is provided as available. To the extent the law allows, we are not liable for indirect losses or for the conduct of users. Nothing here
              limits rights you have under applicable consumer law.
            </p>
          ),
        },
        {
          heading: 'Changes',
          body: <p>We may update these terms. Material changes will be announced in the app, and continuing to use JobWahala after a change means you accept it.</p>,
        },
      ]}
    />
  )
}
