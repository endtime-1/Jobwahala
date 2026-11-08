import { Link } from 'react-router-dom'
import LegalDraftNotice from '../components/LegalDraftNotice'
import LegalPage from '../components/LegalPage'
import { LEGAL, updatedLabel } from '../content/legal'

// DRAFT. Written to describe what the product actually does today, and to follow the structure of the
// Data Protection Act, 2012 (Act 843). It has not been reviewed by a lawyer. Items in [square brackets]
// are facts only the company can fill in or confirm.

export default function Privacy() {
  return (
    <LegalPage
      title="Privacy Policy"
      description="What personal data JobWahala collects, why, who sees it, and your rights under Ghana's Data Protection Act, 2012 (Act 843). Draft."
      updated={updatedLabel()}
      draftNotice={LEGAL.reviewedByLawyer ? undefined : <LegalDraftNotice />}
      intro="This policy explains what personal data we collect when you use JobWahala, why we collect it, who we share it with, how long we keep it, and the rights you have over it."
      sections={[
        {
          heading: 'Who we are',
          body: (
            <>
              <p>
                JobWahala (&quot;we&quot;, &quot;us&quot;) is operated by {LEGAL.operatorName}, {LEGAL.address}, Ghana. We decide how and why your
                personal data is used, which makes us the &quot;data controller&quot; under Ghana&apos;s Data Protection Act, 2012 (Act 843).
              </p>
              <p>
                Registration with the Data Protection Commission: {LEGAL.dpcRegistration}. Privacy contact: {LEGAL.contactEmail}.
              </p>
            </>
          ),
        },
        {
          heading: 'The law that applies',
          body: (
            <p>
              We handle your personal data in line with the Data Protection Act, 2012 (Act 843) and the Data Protection Commission&apos;s guidance. That
              means we collect only what we need for a clear purpose, tell you what that purpose is, keep it accurate and secure, and respect your
              rights.
            </p>
          ),
        },
        {
          heading: 'What we collect',
          body: (
            <ul className="list-disc space-y-1 pl-5">
              <li>Sign-in details: email address and password (stored only as a one-way hash), and/or a mobile phone number you confirm with a code.</li>
              <li>Profile content: your name, skills, experience, CV text you generate, company details and services you list.</li>
              <li>Activity: job applications and cover letters, saved searches and alerts, messages you send, proposals, agreements, reviews and reports.</li>
              <li>
                Employer verification: your company&apos;s Registrar-General registration number, registration certificate, physical address and company
                contact details.
              </li>
              <li>Identity verification evidence, if you choose to submit it.</li>
              <li>
                Payments: what you bought, the amount, any VAT, the date, the payment reference and receipt number, and the name and email on the receipt. Card
                and mobile money details are handled by Paystack; we do not see or store card numbers.
              </li>
              <li>Teams and searches: the email addresses of colleagues an employer invites, and the searches an employer saves in the CV database.</li>
              <li>
                Technical data: your IP address and device information, used for security, to stop abuse and to limit how many codes can be requested.
                Error reports, with personal details removed (see &quot;Service providers&quot;).
              </li>
            </ul>
          ),
        },
        {
          heading: 'Why we use it, and our basis for doing so',
          body: (
            <>
              <p>We use your data only for these purposes, and not for anything incompatible with them:</p>
              <ul className="list-disc space-y-1 pl-5">
                <li>To provide the service you asked for: running your account, showing your profile, letting you apply for and post jobs, and sending status updates. (Performing our agreement with you.)</li>
                <li>To keep the platform safe: verifying employers, preventing fraud and spam, handling reports and disputes. (Our legitimate interest, and legal obligations.)</li>
                <li>To send you messages you would expect: one-time codes, job alerts you set up, and updates about your applications. (Performing our agreement; your consent for alerts.)</li>
                <li>To meet legal and accounting obligations. (Legal obligation.)</li>
                <li>To improve and fix the service, using error reports. (Our legitimate interest.)</li>
              </ul>
            </>
          ),
        },
        {
          heading: 'Automated suggestions and AI features',
          body: (
            <p>
              We show a &quot;fit&quot; score and reasons between applicants and jobs, and AI tools can draft CVs, proposals and coaching. Scores only
              help people prioritise: an employer decides who to shortlist or hire, and no one is rejected by the score alone. When you use an AI
              feature, the text you provide is sent to an AI service provider to produce the draft. Do not include information you are not comfortable
              sharing for that purpose.
            </p>
          ),
        },
        {
          heading: 'The CV database: who can see what',
          body: (
            <>
              <p>
                The CV database lets employers search for job seekers. It is your choice, and it is <strong>Hidden</strong> unless you switch it on. You choose
                when you sign up, and you can change it at any time in your dashboard. If you switch it to Hidden, you stop appearing in searches straight away.
              </p>
              <p>If you choose &quot;Visible to verified employers&quot;:</p>
              <ul className="list-disc space-y-1 pl-5">
                <li>
                  <strong>Who can search:</strong> only employers whose business we have verified and who are on a paid plan that includes the CV database.
                  Job seekers, unverified employers and the public cannot.
                </li>
                <li>
                  <strong>What they see before unlocking:</strong> a limited profile: your headline, skills, a short summary of your experience, location, education
                  level, availability, years of experience, when you were last active, and whether you hold a verified certificate. We remove email addresses, phone
                  numbers and web links that you may have typed into those free-text fields.
                </li>
                <li>
                  <strong>What stays hidden until they unlock your profile:</strong> your name, phone number, email address and CV file. An employer unlocks a profile
                  using a limited monthly allowance that comes with their plan. We keep a record of every unlock (which employer, which profile, when, and which team
                  member), and we tell you when your profile is unlocked.
                </li>
                <li>
                  <strong>Who looked:</strong> you can see which companies viewed or unlocked your profile, and you can block any company. A blocked company can no
                  longer find, view, unlock or invite you, and can no longer open your CV.
                </li>
                <li>
                  <strong>Invitations:</strong> an employer can invite you to apply to one of their jobs. You get a notification; no contact details are shared by an
                  invitation.
                </li>
                <li>
                  <strong>Limits:</strong> searches and unlocks are rate limited, results only go a few pages deep, and there is no way to export contact details in bulk.
                </li>
                <li>
                  <strong>Email alerts:</strong> employers can save a search and get an email saying how many new people match. The email never names or describes
                  anyone.
                </li>
                <li>
                  <strong>Profile boost:</strong> if you pay for a boost, your profile appears higher in results for 30 days and is marked &quot;Boosted&quot; to
                  employers. A boost does not show anything extra about you; it only changes the order.
                </li>
              </ul>
              <p>
                An employer who unlocks your details becomes responsible for how they use them and must use them only for hiring, as our Terms of Service require. Deleting your account removes your profile from the CV database, along with the records of who viewed and unlocked it.
              </p>
            </>
          ),
        },
        {
          heading: 'Payments, plans and receipts',
          body: (
            <>
              <p>
                When you buy something, Paystack takes the payment and tells us the result. We keep a record of each payment (what, how much, when, the reference
                and your receipt number) so we can give you receipts and refunds and meet accounting rules.
              </p>
              <p>
                For a plan that renews, Paystack keeps a token for your card or mobile money account so it can take the next payment. We keep that token only to
                run renewals and to schedule a plan change. Cancelling the plan stops further payments. We email you before a renewal, and if a payment fails,
                and nothing else about it goes to anyone but you.
              </p>
            </>
          ),
        },
        {
          heading: 'The Hiring Service: recruiters and candidates',
          body: (
            <>
              <p>
                When a company buys the Hiring Service, our recruiters search the profiles of people who chose to be visible, and may contact some of them. A recruiter
                sees only a limited profile at first. A person&apos;s name, contact details and CV open to the recruiter once the person agrees, or if they made their
                profile visible.
              </p>
              <ul className="list-disc space-y-1 pl-5">
                <li>
                  <strong>Your yes comes first.</strong> We do not share your profile, CV or contact details with the hiring company until you agree, in the app. We
                  record when you agreed and the wording you agreed to. You can say no, and you can change your mind before the company contacts you.
                </li>
                <li>
                  <strong>What the company sees.</strong> After you agree and are shortlisted: your name, a summary written by the recruiter, your ratings against the
                  role, your profile details, your CV and your contact details. The recruiter&apos;s private notes about you are not shared.
                </li>
                <li>
                  <strong>Who at JobWahala can see it.</strong> Only the recruiter assigned to that search, and administrators. Recruiters cannot open searches that are not
                  assigned to them. Every time a recruiter opens your profile it is recorded in our audit log.
                </li>
                <li>
                  <strong>Companies you blocked</strong> never receive your details through this service.
                </li>
              </ul>
            </>
          ),
        },
        {
          heading: 'Teams, messages and job views',
          body: (
            <ul className="list-disc space-y-1 pl-5">
              <li>
                <strong>Teams:</strong> an employer can invite colleagues by email. A team member can see and work on that company&apos;s jobs and applicants, and
                cannot see its billing. The owner can remove a member at any time.
              </li>
              <li>
                <strong>Messages:</strong> only the two people in a conversation (and administrators handling a report) can read it. The &quot;typing&quot; sign
                shows live to the other person and is not stored.
              </li>
              <li>
                <strong>Job views:</strong> we count how many people look at a job so employers can see how it is doing. A visitor is counted once a day using a
                scrambled code, not their name, and the company&apos;s own team and search-engine robots are not counted.
              </li>
            </ul>
          ),
        },
        {
          heading: 'Who we share it with',
          body: (
            <>
              <p>
                Other members see what you choose to publish and what is needed to work together. Employers see your application. Companies see
                each other&apos;s public company pages. We do not sell your personal data.
              </p>
              <p>These service providers process data for us under agreements that limit how they may use it:</p>
              <ul className="list-disc space-y-1 pl-5">
                <li>Hosting and database: Railway.</li>
                <li>Email delivery (verification, password reset, receipts, alerts): Brevo.</li>
                <li>Text messages (one-time codes): Arkesel.</li>
                <li>Bot protection on sign-up, the waitlist and reporting: Cloudflare Turnstile.</li>
                <li>Error monitoring: Sentry. We configure it to remove emails, phone numbers, tokens and message content before an error report leaves our servers.</li>
                <li>Payments: Paystack (card and mobile money). They tell us whether a payment went through; they do not give us your card number.</li>
                <li>AI drafting: OpenAI.</li>
              </ul>
              <p>We may also share data where the law requires it, or to protect people from fraud or harm.</p>
            </>
          ),
        },
        {
          heading: 'Sending data outside Ghana',
          body: (
            <p>
              Some of our providers are based, or store data, outside Ghana. Where that happens we take steps so your data stays protected to the standard
              Act 843 expects.
            </p>
          ),
        },
        {
          heading: 'How long we keep it',
          body: (
            <ul className="list-disc space-y-1 pl-5">
              <li>Your account data: while your account is open.</li>
              <li>
                When you delete your account: your name, email, phone, profile, CVs, saved searches, alerts, verification documents and notifications
                are deleted, and the account is emptied. Your messages are blanked. Applications are withdrawn.
              </li>
              <li>
                Records we must keep, such as payments and agreements, are kept without your name for {LEGAL.paymentRecordYears} years to meet accounting and legal
                duties.
              </li>
              <li>One-time codes: removed once used or expired. Security logs: kept only as long as security needs them, then deleted.</li>
            </ul>
          ),
        },
        {
          heading: 'Your rights under Act 843',
          body: (
            <>
              <p>You have the right to:</p>
              <ul className="list-disc space-y-1 pl-5">
                <li>Know what we hold about you and why (this policy, and the copy below).</li>
                <li>Get a copy of your data. You can{' '}
                  <Link to="/settings" className="font-bold text-primary hover:underline">download it yourself in Account settings</Link>.
                </li>
                <li>Correct data that is wrong or out of date. You can edit most of it in your profile, or ask us.</li>
                <li>Have your data deleted. You can{' '}
                  <Link to="/settings" className="font-bold text-primary hover:underline">delete your account in Account settings</Link>.
                </li>
                <li>Object to our use of your data, and withdraw consent you gave (for example turn off job alerts) at any time.</li>
                <li>Ask that no important decision about you is made only by automated means.</li>
              </ul>
              <p>
                To use a right we cannot offer in your settings, contact {LEGAL.contactEmail} or use the{' '}
                <Link to="/support" className="font-bold text-primary hover:underline">Support centre</Link>. We aim to reply within 30 days.
              </p>
            </>
          ),
        },
        {
          heading: 'Security',
          body: (
            <p>
              Traffic is encrypted in transit. Passwords are stored hashed. One-time codes are stored hashed and expire quickly. Evidence files are stored
              under private addresses and shown only to the people involved and administrators. Access is limited by role, requests are rate limited, and
              sign-up forms are protected against bots. No system is perfectly secure; if a breach affects your data we will tell you and the Data
              Protection Commission as the law requires.
            </p>
          ),
        },
        {
          heading: 'Children',
          body: (
            <p>
              JobWahala is for people aged {LEGAL.minimumAge} and over. We do not knowingly collect data from children. If you think a child has given us data, tell us
              and we will delete it.
            </p>
          ),
        },
        {
          heading: 'Cookies and local storage',
          body: (
            <p>
              We store a sign-in token and a few preferences in your browser so you stay logged in. The bot check from Cloudflare may set its own
              cookie or token to tell people from automated traffic. We do not use advertising or tracking cookies.
            </p>
          ),
        },
        {
          heading: 'Complaints',
          body: (
            <p>
              If you are unhappy with how we handle your data, please tell us first so we can put it right. You also have the right to complain to the
              Data Protection Commission of Ghana. You can find the Commission&apos;s current contact details on its website.
            </p>
          ),
        },
        {
          heading: 'Changes to this policy',
          body: <p>We will update this page when our practices change and announce important changes in the app. The date at the top shows when it was last changed.</p>,
        },
      ]}
    />
  )
}
