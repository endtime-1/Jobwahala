import { Link } from 'react-router-dom'
import LegalPage from '../components/LegalPage'
import { LEGAL } from '../content/legal'

const link = 'font-bold text-primary hover:underline'
const list = 'list-disc space-y-1 pl-5'

export default function Terms() {
  return (
    <LegalPage
      title="Terms of Service"
      description="The rules for using JobWahala as a job seeker or an employer, including paid services, refunds, the CV database and the Hiring Service."
      effective={LEGAL.effectiveDate}
      updated={LEGAL.lastUpdated}
      intro="These terms are the agreement between you and JobWahala. By creating an account or using the website you agree to them. If you do not agree, please do not use JobWahala."
      sections={[
        {
          heading: 'Who we are',
          body: (
            <>
              <p>
                {LEGAL.serviceName} ({LEGAL.website}) is operated by {LEGAL.founder}, in {LEGAL.location}. It is an online job portal that connects people looking for
                work with employers.
              </p>
              <p>
                We are not an employer, and we are not a party to any job or employment that comes from the site. Contact us at {LEGAL.contactEmail}, or by phone or
                WhatsApp on {LEGAL.phone}.
              </p>
            </>
          ),
        },
        {
          heading: 'Your account',
          body: (
            <>
              <p>
                You must be at least {LEGAL.minimumAge} years old and give true information. You can sign up with an email and password, with Google, or with a Ghana mobile
                number confirmed by a code we send by text message. Keep your login private. You are responsible for what happens in your account.
              </p>
              <p>
                You can sign up as a job seeker or an employer. An employer can invite colleagues to its team. The account owner is responsible for what its team does,
                and can remove a member at any time. Staff accounts are created only by JobWahala.
              </p>
            </>
          ),
        },
        {
          heading: 'What is free and what is paid',
          body: (
            <>
              <p>
                <strong>Job seekers:</strong> a free account, profile, CV tools, job applications, saved jobs and job alerts. You are never charged to apply for a job.
              </p>
              <p>
                <strong>Employers:</strong> posting jobs, receiving applications, the applicant board and employer verification are free.
              </p>
              <p>These extras are paid, where they are offered. The price is shown to you before you pay:</p>
              <ul className={list}>
                <li>
                  <strong>Plans</strong> (monthly or yearly): for example featured-job credits, a branded company page, more team members, CV database access and hiring
                  reports. See the{' '}
                  <Link to="/plans" className={link}>
                    Plans page
                  </Link>
                  .
                </li>
                <li>
                  <strong>Featured jobs, job boosts and job packs.</strong> A featured course listing for training providers.
                </li>
                <li>
                  <strong>A profile boost</strong> for job seekers, which shows your profile higher in CV database results for 30 days. It never shows anything extra
                  about you.
                </li>
                <li>
                  <strong>The Hiring Service</strong> (see below).
                </li>
              </ul>
              <p>
                <strong>Paying never buys trust.</strong> A paid service does not make an employer verified, and never ranks an unverified employer above a verified one.
              </p>
            </>
          ),
        },
        {
          heading: 'Paying, plans and renewals',
          body: (
            <>
              <p>
                Prices are in Ghana cedis (GHS). You pay by card or mobile money through Paystack. We do not see or keep your card number. You get a receipt by email and on
                the Billing page. If VAT applies, it is shown on the receipt.
              </p>
              <ul className={list}>
                <li>
                  <strong>Plans renew by themselves</strong> each month or year until you cancel. You can cancel at any time on the Billing page. A cancelled plan works
                  until the end of the period you paid for.
                </li>
                <li>
                  <strong>Changing plan:</strong> moving up starts straight away and you pay the new price. Moving down starts when your current period ends.
                </li>
                <li>
                  <strong>If a renewal payment fails</strong> you have 7 days to fix it, and we remind you. After that your account moves to the Free plan. Nothing is
                  deleted, but plan features switch off.
                </li>
                <li>
                  <strong>Credits</strong> that come with a plan expire when the next month&apos;s credits arrive, or when the plan ends. Credits you buy in a job pack
                  never expire.
                </li>
                <li>
                  <strong>Price changes:</strong> people already on a plan keep their price until they change plan or cancel. We tell you before any renewal at a different
                  price.
                </li>
              </ul>
            </>
          ),
        },
        {
          heading: 'Refunds and cancellations',
          body: (
            <>
              <ul className={list}>
                <li>
                  <strong>If we got it wrong</strong>, you get a full refund: you were charged twice, you were charged but did not receive what you paid for, or you were
                  charged after you cancelled.
                </li>
                <li>
                  <strong>Plans:</strong> if you ask within {LEGAL.planRefundDays} days of your first payment for a plan and have not used its credits or features, we
                  refund that payment. After that we do not refund the part of a period you have paid for, but the plan keeps working until it ends.
                </li>
                <li>
                  <strong>Promotions, job packs and profile boosts:</strong> if you ask within {LEGAL.promotionRefundHours} hours and have not used it, we refund it. Once it
                  has started running, or credits are spent, it cannot be refunded.
                </li>
                <li>Employer verification is free, so there is nothing to refund.</li>
              </ul>
              <p>
                To ask for a refund, write to {LEGAL.contactEmail} with your receipt number. Refunds go back to the card or mobile money account you paid with, and usually
                take a few working days. Nothing here limits your rights under Ghanaian consumer law.
              </p>
            </>
          ),
        },
        {
          heading: 'The Hiring Service',
          body: (
            <>
              <p>
                In the Hiring Service, our recruiters look for candidates for one role and send you a shortlist. You send a request on the{' '}
                <Link to="/hiring-service" className={link}>
                  Hiring Service page
                </Link>
                . We then contact you to agree the fee and any deposit. Work starts only once the fee is agreed. Your request page shows the agreed fee and what has been
                paid.
              </p>
              <ul className={list}>
                <li>
                  <strong>Candidates agree first.</strong> We ask each person from our database if they agree to be put forward. We do not give you their profile, CV or
                  contact details until they say yes. People who applied to your own job post have already applied to you.
                </li>
                <li>
                  <strong>Only you and our team see the shortlist:</strong> your company, the recruiter assigned to your request, and our administrators.
                </li>
                <li>
                  <strong>Cancelling:</strong> you can cancel a request before work starts. After that, please contact us. We deal with any deposit as set out in the
                  agreement we make with you.
                </li>
                <li>
                  <strong>Replacement guarantee:</strong> if a person you hire through the service leaves, we search again at no extra charge. It lasts for the number of
                  days shown on your request (90 unless we agree otherwise), counted from the day your hire starts. It does not apply if the person was dismissed for a
                  reason unrelated to their fit, or if you did not hire them through the service.
                </li>
                <li>
                  <strong>No guarantee of a hire.</strong> We provide a shortlist of candidates who have agreed to be put forward. Hiring, and the terms of employment, are
                  decided by you and the candidate. We are not the employer.
                </li>
                <li>
                  <strong>Using candidate details:</strong> use them only to consider that person for the role you asked us to fill, and keep them private.
                </li>
              </ul>
            </>
          ),
        },
        {
          heading: 'Jobs and applications',
          body: (
            <>
              <p>
                Employers are responsible for the accuracy and lawfulness of the jobs they post. A job stays open until its closing date (at most 90 days), and the
                employer can edit, pause, extend or close it. Job seekers are responsible for the accuracy of their applications.
              </p>
              <p>
                <strong>You must never have to pay to apply for a job.</strong> We remove any listing that asks applicants for money. Please report it.
              </p>
            </>
          ),
        },
        {
          heading: 'Employer verification',
          body: (
            <p>
              Employers can ask to be verified by giving their registration details, a certificate, an address and a contact we confirm with a code. Our team reviews each
              request. A &quot;Verified employer&quot; badge means we checked those documents at that time. It is not a promise about any job or about how the employer
              behaves. False documents lead to removal and may be reported to the authorities.
            </p>
          ),
        },
        {
          heading: 'The CV database',
          body: (
            <>
              <p>
                <strong>Job seekers:</strong> being in the CV database is your choice and is off unless you switch it on. If you do, verified employers on a plan that
                includes it see a limited profile. Your name, phone, email and CV stay hidden until an employer unlocks your profile. You can switch it off at any time,
                see which companies looked, and block any company. See the{' '}
                <Link to="/privacy" className={link}>
                  Privacy Policy
                </Link>
                .
              </p>
              <p>
                <strong>Employers:</strong> only verified employers on a plan that includes the CV database can search it, within a monthly limit. Every unlock is
                recorded. Use what you unlock only to consider that person for a job at your company. Do not:
              </p>
              <ul className={list}>
                <li>copy or collect profiles in bulk, or get round the limits;</li>
                <li>share, sell or pass the details to anyone else;</li>
                <li>use them for marketing, spam, or anything not about hiring;</li>
                <li>contact someone who has blocked you.</li>
              </ul>
              <p>We may remove access, suspend the account and report misuse to the authorities.</p>
            </>
          ),
        },
        {
          heading: 'Freelance gigs: coming soon',
          body: (
            <p>
              Freelance gigs, proposals and agreements between members are coming soon and are not offered yet. We do not hold, pay out or handle money between members.
              When they open we will publish the terms that apply to them before you can use them.
            </p>
          ),
        },
        {
          heading: 'Acceptable use',
          body: (
            <>
              <p>
                Do not post unlawful, false or discriminatory content, pretend to be someone else, harass other users, copy data from the site with bots or scrapers, send
                spam, get round our security, or use JobWahala for anything illegal.
              </p>
              <p>You can report jobs, companies or users. We may flag, suspend or remove content and accounts that break these terms.</p>
            </>
          ),
        },
        {
          heading: 'Your data and your content',
          body: (
            <p>
              You keep ownership of what you post. You allow us to store and show it as needed to run JobWahala. How we handle personal data is in our{' '}
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
              You can delete your account yourself. An employer with a plan that will renew must cancel it first, so the card is not charged again. An employer&apos;s open
              jobs are closed. We may suspend or end an account that breaks these terms, and we will tell you why where we can.
            </p>
          ),
        },
        {
          heading: 'Liability',
          body: (
            <p>
              JobWahala is provided as available. As far as the law allows, we are not responsible for indirect losses, for what users do, or for how accurate jobs are.
              Nothing here limits your rights under Ghanaian consumer law.
            </p>
          ),
        },
        {
          heading: 'Governing law',
          body: <p>These terms are governed by the laws of the Republic of Ghana. The courts of Ghana have jurisdiction over any dispute.</p>,
        },
        {
          heading: 'Changes to these terms',
          body: (
            <p>
              We may update these terms. When we do, we change the &quot;last updated&quot; date at the top of this page, and we tell you in the app about important
              changes. If you keep using JobWahala after a change, you accept it.
            </p>
          ),
        },
        {
          heading: 'Contact us',
          body: (
            <p>
              {LEGAL.operatorName}, {LEGAL.location}. Email {LEGAL.contactEmail}. Phone or WhatsApp {LEGAL.phone}. You can also use the{' '}
              <Link to="/support" className={link}>
                Support centre
              </Link>
              .
            </p>
          ),
        },
      ]}
    />
  )
}
