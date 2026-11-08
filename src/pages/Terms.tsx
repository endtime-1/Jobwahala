import { Link } from 'react-router-dom'
import LegalDraftNotice from '../components/LegalDraftNotice'
import LegalPage from '../components/LegalPage'
import { LEGAL, updatedLabel } from '../content/legal'

// DRAFT. Describes how the product works today. The business details and the proposed numbers live in
// src/content/legal.ts. Not reviewed by a lawyer until `reviewedByLawyer` is set there.

const link = 'font-bold text-primary hover:underline'

export default function Terms() {
  return (
    <LegalPage
      title="Terms of Service"
      description="The rules for using JobWahala as a job seeker or an employer, including paid services, refunds and the CV database."
      updated={updatedLabel()}
      draftNotice={LEGAL.reviewedByLawyer ? undefined : <LegalDraftNotice />}
      intro="These terms govern your use of JobWahala. By creating an account you agree to them. If you do not agree, please do not use the platform."
      sections={[
        {
          heading: 'Who we are, and what JobWahala is',
          body: (
            <p>
              JobWahala is operated by {LEGAL.operatorName}, {LEGAL.address}, Ghana. It is an online job portal that connects people who are looking for
              work with employers. We are not an employer or a recruitment agent for the jobs posted, and we are not a party to any employment that
              results. You can reach us at {LEGAL.contactEmail} or through the{' '}
              <Link to="/support" className={link}>
                Support centre
              </Link>
              .
            </p>
          ),
        },
        {
          heading: 'Your account',
          body: (
            <>
              <p>
                You must be at least {LEGAL.minimumAge} years old and give accurate information. You can sign up with an email address and password, with
                Google, or with a Ghana mobile number confirmed by a one-time code that we send by text message. Keep your login details secure; you are
                responsible for activity on your account.
              </p>
              <p>
                You can register as a job seeker or an employer. An employer can invite colleagues to its team. The account owner is responsible for what its
                team members do, and can remove them at any time. Administrator accounts are created by JobWahala only.
              </p>
            </>
          ),
        },
        {
          heading: 'Freelance gigs, payments and escrow (not available yet)',
          body: (
            <p>
              Freelance gigs, proposals, agreements, escrow and payouts between members are planned but not open. We do not hold or pay out money between
              members. When these features launch we will publish the terms that apply to them here before you can use them. The paid services we sell
              ourselves are described in the next sections.
            </p>
          ),
        },
        {
          heading: 'What is free and what is paid',
          body: (
            <>
              <p>
                It is free for job seekers to join, search and apply. It is free for employers to post jobs, receive applications and review applicants on the
                applicant board. You are never asked to pay to apply for a job.
              </p>
              <p>We charge only for optional services:</p>
              <ul className="list-disc space-y-1 pl-5">
                <li>
                  <strong>Employer plans (Starter and Business):</strong> monthly or yearly. They add things such as monthly featured-job and &quot;Urgently
                  hiring&quot; credits, a branded company page, more team members and, on Business, the CV database, hiring reports and priority in &quot;Top
                  employers&quot;. What each plan includes, and its price, is shown on the{' '}
                  <Link to="/plans" className={link}>
                    Plans page
                  </Link>
                  .
                </li>
                <li>
                  <strong>One-off promotions:</strong> a featured job (30 days), a job boost (7 days), job packs of featured-job credits, and a featured course
                  listing for training providers (30 days).
                </li>
                <li>
                  <strong>Profile boost for job seekers:</strong> shows your profile higher in CV database results, marked &quot;Boosted&quot;, for 30 days. It
                  never shows anything extra about you.
                </li>
              </ul>
              <p>
                <strong>Paying never affects trust.</strong> A plan or promotion does not make an employer verified, and never ranks an unverified employer
                above a verified one.
              </p>
            </>
          ),
        },
        {
          heading: 'Paying, plans and renewals',
          body: (
            <>
              <p>
                Prices are in Ghana cedis (GHS). You pay by card or mobile money through Paystack, our payment provider. We do not see or store your card
                number. The price is worked out on our server at checkout, and you receive a receipt by email and on the Billing page. If VAT applies, it is
                shown separately on your receipt.
              </p>
              <ul className="list-disc space-y-1 pl-5">
                <li>
                  <strong>Plans renew by themselves</strong> each month or year until you cancel. You can cancel at any time on the Billing page. A cancelled
                  plan keeps working until the end of the period you paid for.
                </li>
                <li>
                  <strong>Changing plan:</strong> moving up takes effect straight away and you pay the new price in full. Moving down starts when your current
                  period ends, so you keep what you paid for.
                </li>
                <li>
                  <strong>If a renewal payment fails</strong> you have 7 days to fix it, and we remind you. After that your account moves to the Free plan.
                  Nothing is deleted: your jobs, applicants and team stay, but members above the Free limit are paused and plan features switch off.
                </li>
                <li>
                  <strong>Credits:</strong> the credits that come with a plan expire when the next month&apos;s credits arrive, or when the plan ends. Credits you
                  buy in a job pack never expire.
                </li>
                <li>
                  <strong>Price changes:</strong> if we change a plan&apos;s price, people already on it keep their price until they change plan or cancel. We
                  will tell you before any renewal at a different price.
                </li>
              </ul>
            </>
          ),
        },
        {
          heading: 'Refunds and cancellations',
          body: (
            <>
              <ul className="list-disc space-y-1 pl-5">
                <li>
                  <strong>If we got it wrong</strong>, you are refunded in full: you were charged twice, you were charged but the plan, credits or promotion
                  never arrived, or you were charged after you cancelled.
                </li>
                <li>
                  <strong>Plans:</strong> you can cancel at any time and will not be charged again. If you ask within {LEGAL.planRefundDays} days of your first
                  payment for a plan and have not used its credits or features, we refund that payment. After that we do not refund the part of a period
                  you have already paid for, but the plan keeps working until it ends.
                </li>
                <li>
                  <strong>One-off promotions and the profile boost:</strong> if you ask within {LEGAL.promotionRefundHours} hours and have not used it, we refund it.
                  Once a promotion has been running, or a boost has shown your profile, it cannot be refunded.
                </li>
                <li>
                  <strong>Job packs:</strong> credits you have not used can be refunded within {LEGAL.promotionRefundHours} hours of buying. Used credits cannot.
                </li>
                <li>
                  <strong>Verification</strong> is free and is never sold, so there is nothing to refund for it.
                </li>
              </ul>
              <p>
                To ask for a refund, write to {LEGAL.contactEmail} or use the{' '}
                <Link to="/support" className={link}>
                  Support centre
                </Link>{' '}
                with your receipt number. Refunds go back to the card or mobile money account you paid with. How long they take to appear depends on your bank
                or mobile money provider, usually a few working days. If a refund is paid for something you were already given, we take that back (for
                example the credits). Nothing here limits the rights you have under Ghanaian consumer law.
              </p>
            </>
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
          heading: 'The CV database',
          body: (
            <>
              <p>
                <strong>For job seekers:</strong> being in the CV database is your choice and is off unless you switch it on. If you do, verified employers on a
                plan that includes it can see a limited profile. Your name, phone, email and CV stay hidden until an employer unlocks your profile. You can switch
                it off at any time, see which companies looked, and block any company. More detail is in the{' '}
                <Link to="/privacy" className={link}>
                  Privacy Policy
                </Link>
                .
              </p>
              <p>
                <strong>For employers:</strong> only verified employers on a plan that includes the CV database can search it. Each plan has a monthly allowance
                of unlocks, and every unlock is recorded. If you unlock someone&apos;s details, you may use them only to consider that person for a job at your
                company. You must not:
              </p>
              <ul className="list-disc space-y-1 pl-5">
                <li>copy, export or collect profiles in bulk, or try to get round the limits on searches and unlocks;</li>
                <li>share, sell or pass the details to anyone else;</li>
                <li>use them for marketing, spam, or anything unrelated to hiring;</li>
                <li>contact someone who has blocked you.</li>
              </ul>
              <p>We may remove access, suspend the account and report misuse to the authorities.</p>
            </>
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
              <Link to="/privacy" className={link}>
                Privacy Policy
              </Link>
              , which follows Ghana&apos;s Data Protection Act, 2012 (Act 843). You can download your data and delete your account at any time in{' '}
              <Link to="/settings" className={link}>
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
              You can delete your account yourself. Some things must be finished first: an employer with a plan that will renew must cancel it first, so the
              card is not charged again, and active work agreements must be completed. An employer&apos;s open jobs are closed. We may suspend or end an
              account that breaks these terms, and will tell you why where we can.
            </p>
          ),
        },
        {
          heading: 'Liability',
          body: (
            <p>
              JobWahala is provided as available. To the extent the law allows, we are not liable for indirect losses, for the conduct of users, or for
              the accuracy of jobs. Nothing here limits rights you have under Ghanaian consumer law.
            </p>
          ),
        },
        {
          heading: 'Governing law and disputes',
          body: <p>These terms are governed by the laws of Ghana. If we cannot settle a disagreement between us, the courts of Ghana decide it.</p>,
        },
        {
          heading: 'Changes',
          body: <p>We may update these terms. Material changes will be announced in the app, and continuing to use JobWahala after a change means you accept it.</p>,
        },
      ]}
    />
  )
}
