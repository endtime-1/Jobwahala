import { Link } from 'react-router-dom'
import LegalPage from '../components/LegalPage'
import { LEGAL } from '../content/legal'

const link = 'font-bold text-primary hover:underline'
const list = 'list-disc space-y-1 pl-5'

export default function Privacy() {
  return (
    <LegalPage
      title="Privacy Policy"
      description="What personal data JobWahala collects, why, who sees it, and your rights under Ghana's Data Protection Act, 2012 (Act 843)."
      effective={LEGAL.effectiveDate}
      updated={LEGAL.lastUpdated}
      intro="This policy explains what personal data we collect when you use JobWahala, why, who sees it, how long we keep it, and the rights you have."
      sections={[
        {
          heading: 'Who we are',
          body: (
            <>
              <p>
                {LEGAL.serviceName} ({LEGAL.website}) is operated by {LEGAL.founder}, in {LEGAL.location}. We decide how and why your personal data is used, which
                makes us the &quot;data controller&quot; under Ghana&apos;s Data Protection Act, 2012 (Act 843).
              </p>
              <p>
                For any privacy question or request, contact {LEGAL.contactEmail}, or call or WhatsApp {LEGAL.phone}.
              </p>
            </>
          ),
        },
        {
          heading: 'The law that applies',
          body: (
            <p>
              We handle your personal data in line with the Data Protection Act, 2012 (Act 843). That means we collect only what we need for a clear purpose, tell you
              what the purpose is, keep the data accurate and safe, and respect your rights.
            </p>
          ),
        },
        {
          heading: 'What we collect',
          body: (
            <ul className={list}>
              <li>Sign-in details: your email address and password (we store only a one-way hash of it), and/or a mobile phone number you confirm with a code.</li>
              <li>Your profile: name, skills, experience, location, education, CV files and CV text you create, and company details for employers.</li>
              <li>Your activity: job applications and cover letters, saved jobs, saved searches and job alerts, messages you send, and reports you make.</li>
              <li>Employer verification: the company&apos;s registration number, registration certificate, address and company contact details.</li>
              <li>Identity verification documents, only if you choose to send them.</li>
              <li>
                Payments: what you bought, the amount, any VAT, the date, the payment reference and receipt number, and the name and email on the receipt. Paystack
                handles card and mobile money details. We do not see or store card numbers.
              </li>
              <li>Team and search data: the emails of colleagues an employer invites, and the searches an employer saves in the CV database.</li>
              <li>
                Technical data: your IP address and device details, used for security, to stop abuse and to limit how many codes can be requested. Error reports, with
                personal details removed.
              </li>
            </ul>
          ),
        },
        {
          heading: 'Why we use it',
          body: (
            <>
              <p>We use your data only for these purposes:</p>
              <ul className={list}>
                <li>To run the service you asked for: your account, your profile, applying for and posting jobs, and updates on your applications.</li>
                <li>To keep JobWahala safe: verifying employers, preventing fraud and spam, and handling reports.</li>
                <li>To send messages you would expect: one-time codes, job alerts you set up, receipts, and updates about your applications.</li>
                <li>To meet legal and accounting duties.</li>
                <li>To fix and improve the service, using error reports.</li>
              </ul>
            </>
          ),
        },
        {
          heading: 'WhatsApp updates',
          body: (
            <p>
              You can follow our WhatsApp channel for new jobs. That is your choice and is run by WhatsApp, which has its own privacy policy. We do not need your phone
              number to post to the channel. The &quot;Share on WhatsApp&quot; button only opens WhatsApp with a message ready for you to send. We do not send it.
            </p>
          ),
        },
        {
          heading: 'Automated suggestions and AI tools',
          body: (
            <p>
              We show a &quot;fit&quot; score between applicants and jobs, and AI tools can help draft CVs, job posts and coaching tips. Scores only help people decide
              what to look at first. An employer decides who to shortlist or hire, and nobody is rejected by a score alone. When you use an AI tool, the text you give it is
              sent to our AI provider to write the draft. Do not include anything you are not happy to share for that purpose.
            </p>
          ),
        },
        {
          heading: 'Who can see a job seeker’s data',
          body: (
            <>
              <ul className={list}>
                <li>
                  <strong>Employers you apply to</strong> see your application: your profile details, cover letter and the CV you choose to send.
                </li>
                <li>
                  <strong>Verified employers in the CV database</strong> can see a limited profile only if you opt in. The CV database is <strong>Hidden</strong> unless you
                  switch it on, and you can change it at any time.
                </li>
                <li>
                  <strong>Everyone else</strong> does not see your profile.
                </li>
              </ul>
              <p>If you choose &quot;Visible to verified employers&quot;:</p>
              <ul className={list}>
                <li>
                  <strong>Who can search:</strong> only employers whose business we have verified, on a paid plan that includes the CV database.
                </li>
                <li>
                  <strong>What they see first:</strong> your headline, skills, a short summary of your experience, location, education level, availability, years of
                  experience, when you were last active, and whether you hold a verified certificate. We remove emails, phone numbers and web links from those free-text
                  fields.
                </li>
                <li>
                  <strong>What stays hidden until they unlock your profile:</strong> your name, phone number, email address and CV file. Every unlock is recorded and we tell
                  you when it happens.
                </li>
                <li>
                  <strong>You are in control:</strong> you can see which companies viewed or unlocked your profile, and block any company. A blocked company can no longer
                  find you, view you, unlock you, invite you or open your CV.
                </li>
                <li>
                  <strong>Invitations:</strong> an employer can invite you to apply to a job. No contact details are shared by an invitation.
                </li>
                <li>
                  <strong>Profile boost:</strong> if you pay for one, your profile appears higher in results for 30 days. It does not show anything extra about you.
                </li>
              </ul>
              <p>An employer who unlocks your details must use them only for hiring, as our Terms require.</p>
            </>
          ),
        },
        {
          heading: 'The Hiring Service: recruiters and candidates',
          body: (
            <>
              <p>
                When an employer uses the Hiring Service, our recruiters search the profiles of people who chose to be visible, and the people who applied to the
                employer&apos;s job post. They may contact some of them.
              </p>
              <ul className={list}>
                <li>
                  <strong>Your yes comes first.</strong> We do not give your profile, CV or contact details to the employer until you agree, in the app. We record when you
                  agreed and what you agreed to. You can say no.
                </li>
                <li>
                  <strong>What the employer sees</strong> after you agree and are shortlisted: your name, a short note from the recruiter, your profile details, your CV and
                  your contact details. The recruiter&apos;s private notes are not shared.
                </li>
                <li>
                  <strong>Who at JobWahala can see it:</strong> only the recruiter assigned to the request, and administrators. Recruiters cannot open requests that are not
                  assigned to them. Every time a recruiter opens a profile, it is recorded in our audit log.
                </li>
                <li>
                  <strong>Companies you blocked</strong> never receive your details through this service.
                </li>
              </ul>
            </>
          ),
        },
        {
          heading: 'Payments',
          body: (
            <>
              <p>
                When you buy something, Paystack takes the payment and tells us the result. We keep a record of each payment so we can give you receipts and refunds and meet
                accounting rules.
              </p>
              <p>
                For a plan that renews, Paystack keeps a token for your card or mobile money account so it can take the next payment. We use it only for renewals and plan
                changes. Cancelling the plan stops further payments.
              </p>
            </>
          ),
        },
        {
          heading: 'Teams, messages and job views',
          body: (
            <ul className={list}>
              <li>
                <strong>Teams:</strong> an employer can invite colleagues by email. A team member can work on the company&apos;s jobs and applicants, but cannot see its
                billing. The owner can remove a member at any time.
              </li>
              <li>
                <strong>Messages:</strong> only the two people in a conversation (and administrators handling a report) can read them.
              </li>
              <li>
                <strong>Job views:</strong> we count how many people look at a job so employers can see how it is doing. A visitor is counted once a day using a scrambled
                code, not their name.
              </li>
            </ul>
          ),
        },
        {
          heading: 'Who we share it with',
          body: (
            <>
              <p>
                Employers see your applications. Other members see only what you choose to publish. Companies can see each other&apos;s public company pages. We do not
                sell your personal data.
              </p>
              <p>These providers process data for us and may use it only to provide their service to us:</p>
              <ul className={list}>
                <li>Hosting and database: Railway.</li>
                <li>Email: Brevo.</li>
                <li>Text messages (one-time codes): Arkesel.</li>
                <li>Bot protection on sign-up and forms: Cloudflare Turnstile.</li>
                <li>Error monitoring: Sentry. We remove emails, phone numbers and message content from error reports before they leave our servers.</li>
                <li>Payments: Paystack. They tell us whether a payment went through. They do not give us your card number.</li>
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
              Some of our providers store data outside Ghana. Where that happens we take steps to keep your data protected to the standard Act 843 expects.
            </p>
          ),
        },
        {
          heading: 'How long we keep it',
          body: (
            <ul className={list}>
              <li>Your account data: while your account is open.</li>
              <li>
                When you delete your account: your name, email, phone, profile, CVs, saved searches, alerts, verification documents and notifications are deleted. Your
                messages are blanked and your applications are withdrawn.
              </li>
              <li>Payment records, which we must keep, are kept without your name for {LEGAL.paymentRecordYears} years for accounting and tax.</li>
              <li>One-time codes are removed once used or expired. Security logs are kept only as long as security needs them.</li>
            </ul>
          ),
        },
        {
          heading: 'Your rights under Act 843',
          body: (
            <>
              <p>You have the right to:</p>
              <ul className={list}>
                <li>Know what we hold about you and why.</li>
                <li>
                  Get a copy of your data. You can{' '}
                  <Link to="/settings" className={link}>
                    download it yourself in Account settings
                  </Link>
                  .
                </li>
                <li>Correct data that is wrong. You can edit most of it in your profile, or ask us.</li>
                <li>
                  Have your data deleted. You can{' '}
                  <Link to="/settings" className={link}>
                    delete your account in Account settings
                  </Link>
                  .
                </li>
                <li>Object to how we use your data, and withdraw consent (for example turn off job alerts) at any time.</li>
                <li>Ask that no important decision about you is made only by a machine.</li>
              </ul>
              <p>
                For any privacy request, write to {LEGAL.contactEmail}. We aim to reply within 30 days.
              </p>
            </>
          ),
        },
        {
          heading: 'Security',
          body: (
            <p>
              Traffic is encrypted. Passwords and one-time codes are stored hashed. Verification documents and CV files are kept at private addresses and shown only to the
              people involved and administrators. Access is limited by role, and sign-up forms are protected against bots. No system is perfectly secure. If a breach affects
              your data, we will tell you and the Data Protection Commission as the law requires.
            </p>
          ),
        },
        {
          heading: 'Children',
          body: (
            <p>
              JobWahala is for people aged {LEGAL.minimumAge} and over. We do not knowingly collect data from children. If you think a child has given us data, tell us and
              we will delete it.
            </p>
          ),
        },
        {
          heading: 'Cookies and local storage',
          body: (
            <p>
              We store a sign-in token and a few preferences in your browser so you stay logged in. The bot check from Cloudflare may set its own cookie or token. We do not
              use advertising or tracking cookies.
            </p>
          ),
        },
        {
          heading: 'Complaints',
          body: (
            <p>
              If you are unhappy with how we handle your data, please tell us first at {LEGAL.contactEmail} so we can put it right. You also have the right to complain to the
              Data Protection Commission of Ghana.
            </p>
          ),
        },
        {
          heading: 'Changes to this policy',
          body: (
            <p>
              We will update this page when our practices change. We change the &quot;last updated&quot; date at the top, and tell you in the app about important changes.
              Contact: {LEGAL.operatorName}, {LEGAL.location}, {LEGAL.contactEmail}, {LEGAL.phone}.
            </p>
          ),
        },
      ]}
    />
  )
}
