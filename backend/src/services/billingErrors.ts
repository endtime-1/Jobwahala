/** Something the person can be told: a status, a code the page can act on, and a plain message. */
export class BillingError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}
