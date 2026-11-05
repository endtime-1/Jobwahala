import { useLayoutEffect } from 'react'
import { useLocation } from 'react-router-dom'

/**
 * Opens every new page at the top. Without this the browser keeps the old scroll position, so following a
 * footer link lands you at the bottom of the next page. Links to a part of a page (#section) are left alone
 * for that page to scroll to, and changing only the search filters does not jump the page.
 */
export default function ScrollToTop() {
  const { pathname, hash } = useLocation()

  useLayoutEffect(() => {
    if (!hash) window.scrollTo(0, 0)
  }, [pathname, hash])

  return null
}
