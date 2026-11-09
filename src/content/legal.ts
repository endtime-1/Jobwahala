/** The facts the Terms of Service and the Privacy Policy depend on, in one place. Change them here and both pages follow. */
export const LEGAL = {
  serviceName: 'JobWahala',
  website: 'https://www.jobwahala.com',
  /** Who runs JobWahala. */
  operatorName: 'JobWahala, operated by Gabriel Kwaku Kusi (Founder & CEO)',
  /** The person who operates it, for sentences that already say "operated by". */
  founder: 'Gabriel Kwaku Kusi (Founder & CEO)',
  location: 'Kumasi, Ashanti Region, Ghana',
  /** Where people write about privacy, refunds and anything else. */
  contactEmail: 'gabriel@jobwahala.com',
  phone: '+233 20 962 4647',

  minimumAge: 18,
  /** Refund window for one-off promotions that have not been used. */
  promotionRefundHours: 48,
  /** Refund window for a first plan payment, if no plan credits or features were used. */
  planRefundDays: 7,
  /** How long payment records are kept, for accounting and tax. */
  paymentRecordYears: 6,

  /** The date these pages take effect, and the date they were last changed. Change both when the text changes. */
  effectiveDate: '8 November 2026',
  lastUpdated: '8 November 2026',
} as const
