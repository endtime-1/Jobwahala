// A calm, accessible set of tints so companies without a logo still look distinct.
const TINTS = [
  'bg-[#e8f0ff] text-[#1e4fd6]',
  'bg-[#e6f7ef] text-[#0f7a4f]',
  'bg-[#fff1e6] text-[#b4531a]',
  'bg-[#f1e9ff] text-[#6b3fc4]',
  'bg-[#e6f6f8] text-[#12707f]',
  'bg-[#fdeaf0] text-[#b02a56]',
]

export const tintFor = (name: string) => {
  let hash = 0
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) >>> 0
  return TINTS[hash % TINTS.length]
}
