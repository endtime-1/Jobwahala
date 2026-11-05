/**
 * Ghanaian mobile numbers. Everything is stored and compared in +233 form.
 *
 * Accepted as typed by people: 024 123 4567, 0241234567, 233241234567, +233 24 123 4567, 00233241234567.
 * The part after +233 must be a real mobile prefix (20, 23-29, 50, 53-57, 59), so landlines and typos
 * that cannot receive an SMS are turned away before we spend money sending one.
 */
const GHANA_MOBILE = /^\+233(?:2[03-9]|5[03-79])\d{7}$/;

export const normalizeGhanaPhone = (raw: string): string | null => {
  const compact = raw.replace(/[\s\-().]/g, '');
  if (!/^\+?\d+$/.test(compact)) return null;

  let national: string;
  if (compact.startsWith('+233')) national = compact.slice(4);
  else if (compact.startsWith('00233')) national = compact.slice(5);
  else if (compact.startsWith('233')) national = compact.slice(3);
  else if (compact.startsWith('0')) national = compact.slice(1);
  else return null;

  const phone = `+233${national}`;
  return GHANA_MOBILE.test(phone) ? phone : null;
};

export const isGhanaMobile = (value: string) => GHANA_MOBILE.test(value);

/** +233241234567 becomes +233 24 *** **67, for showing back to the person without exposing the whole number. */
export const maskPhone = (phone: string) =>
  phone.length < 8 ? '***' : `${phone.slice(0, 4)} ${phone.slice(4, 6)} *** **${phone.slice(-2)}`;
