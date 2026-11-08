import { LEGAL, OPEN_POINTS } from '../content/legal'

/** The banner at the top of the Terms and the Privacy Policy while they wait for a lawyer. Gone once `reviewedByLawyer` is set. */
export default function LegalDraftNotice() {
  if (LEGAL.reviewedByLawyer) return null

  return (
    <>
      <p>This page is a draft. It has not been reviewed by a lawyer and is not yet final. It is not legal advice.</p>
      <p className="mt-3 text-sm font-bold">Still to confirm before launch:</p>
      <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm font-semibold">
        {OPEN_POINTS.map((point) => (
          <li key={point}>{point}</li>
        ))}
      </ul>
    </>
  )
}
