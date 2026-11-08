import { render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('../content/legal', async (importOriginal) => {
  const original = await importOriginal<typeof import('../content/legal')>()
  return { ...original, LEGAL: { ...original.LEGAL, reviewedByLawyer: true } }
})

import LegalDraftNotice from './LegalDraftNotice'

describe('once a lawyer has reviewed the pages', () => {
  it('the draft banner goes away', () => {
    const { container } = render(<LegalDraftNotice />)

    expect(container).toBeEmptyDOMElement()
  })
})
