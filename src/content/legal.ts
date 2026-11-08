/**
 * The facts the Terms and the Privacy Policy depend on, in one place. Fill in the ones in [square brackets], check the
 * proposed numbers, and set `reviewedByLawyer` to true once a lawyer has read both pages: the draft notice then goes away.
 */
export const LEGAL = {
  /** Who runs JobWahala: the registered name, or the trading name until the business is registered. */
  operatorName: '[YOUR LEGAL OR TRADING NAME]',
  address: '[YOUR ADDRESS]',
  /** Where people write about privacy, refunds and anything else. Proposed: the address mail already reaches. */
  contactEmail: 'info@jobwahala.com',
  dpcRegistration: '[REGISTRATION NUMBER, or "in progress"]',

  // Proposed numbers. Change them here and both pages follow.
  minimumAge: 18,
  /** Refund window for one-off promotions that have not been used. */
  promotionRefundHours: 48,
  /** Refund window for a first plan payment, if no plan credits or features were used. */
  planRefundDays: 7,
  /** How long payment records are kept, for accounting and tax. */
  paymentRecordYears: 6,

  lastUpdated: '7 November 2026',
  reviewedByLawyer: false,
} as const

/** What a lawyer (or you) still has to confirm. Shown at the top of both pages while the text is a draft. */
export const OPEN_POINTS = [
  'The name and address of the operator (the items in square brackets).',
  'The Data Protection Commission registration number.',
  'The refund periods in "Refunds and cancellations".',
  'How long payment records must be kept (6 years is proposed).',
  'The limits of liability, and which courts decide disputes.',
  'Whether the legal basis for each use of data, and the sending of data outside Ghana, are described correctly.',
  'The minimum age (18 is proposed).',
] as const

/** The details still in [square brackets]. Empty when the page is ready to publish. */
export const unfilledDetails = () => Object.entries(LEGAL).filter(([, value]) => typeof value === 'string' && value.startsWith('[')).map(([key]) => key)

export const updatedLabel = () => `${LEGAL.lastUpdated}${LEGAL.reviewedByLawyer ? '' : ' (draft)'}`
