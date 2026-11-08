/**
 * A WhatsApp chat link for the number in VITE_WHATSAPP_CONTACT_NUMBER (any format, for example +233 24 123 4567), with a first message
 * already written. Returns null when no usable number is set.
 */
export const whatsappContactLink = (number: unknown, message = 'Hello JobWahala, I would like to post a job.') => {
  const digits = typeof number === 'string' ? number.replace(/[^0-9]/g, '') : ''
  // A real international number has 9 to 15 digits; fewer is a typo or a placeholder.
  if (digits.length < 9 || digits.length > 15) return null
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`
}
