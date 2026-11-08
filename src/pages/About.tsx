import { Link } from 'react-router-dom'
import SEO from '../components/SEO'
import PageHero from '../components/PageHero'
import SocialLinks from '../components/SocialLinks'
import { siteCopy } from '../content/siteCopy'
import { resolveSocialLinks } from '../content/social'

export default function About() {
  const hasSocial = resolveSocialLinks(import.meta.env).length > 0

  return (
    <div className="pb-20 pt-24 xl:pt-28">
      <SEO title="About JobWahala" description={siteCopy.description} />
      <div className="container max-w-4xl">
        <PageHero eyebrow="About us" title="Work without" accent="the wahala.">
          <p className="mt-4 max-w-2xl text-lg font-medium text-white/75">{siteCopy.heroText}</p>
        </PageHero>

        <div className="mt-10 space-y-10 text-lg leading-8 text-text-muted">
          <section aria-labelledby="about-what">
            <h2 id="about-what" className="text-2xl font-black text-text-main">What JobWahala is</h2>
            <p className="mt-3">
              JobWahala is a job portal for Africa, starting in Ghana. Companies post real jobs and people apply in minutes, with the pay and location shown
              before they apply. Job seekers can also find internships, National Service placements and courses, and build a free CV.
            </p>
          </section>

          <section aria-labelledby="about-trust">
            <h2 id="about-trust" className="text-2xl font-black text-text-main">Why you can trust what you see</h2>
            <ul className="mt-3 list-disc space-y-2 pl-6">
              <li>Employers can be checked. A verified badge means we have reviewed the company&apos;s documents.</li>
              <li>You never pay to apply for a job on JobWahala.</li>
              <li>There is a way to report any job or message that looks wrong, and we look at every report.</li>
            </ul>
          </section>

          <section aria-labelledby="about-employers">
            <h2 id="about-employers" className="text-2xl font-black text-text-main">For employers</h2>
            <p className="mt-3">
              Posting jobs is free. You get one board to review applicants, message candidates and, on paid plans, search the CV database.{' '}
              <Link to="/plans" className="font-bold text-primary hover:underline">See the plans</Link>.
            </p>
          </section>

          {hasSocial ? (
            <section aria-labelledby="about-follow">
              <h2 id="about-follow" className="text-2xl font-black text-text-main">Follow JobWahala</h2>
              <p className="mt-3">Get new jobs and job-search tips where you already spend your time.</p>
              <SocialLinks variant="about" className="mt-5" />
            </section>
          ) : null}

          <section aria-labelledby="about-contact">
            <h2 id="about-contact" className="text-2xl font-black text-text-main">Questions?</h2>
            <p className="mt-3">
              Visit the <Link to="/support" className="font-bold text-primary hover:underline">help centre</Link>. Our{' '}
              <Link to="/terms" className="font-bold text-primary hover:underline">Terms of Service</Link> and{' '}
              <Link to="/privacy" className="font-bold text-primary hover:underline">Privacy Policy</Link> explain how JobWahala works with your data.
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}
