import { useEffect } from 'react'
import { useLocation } from './router'

const SECTIONS = new Set(['games', 'categories', 'apps', 'main'])

/** Section links also work when their page arrives in a lazy chunk. */
export function useSectionScroll(): void {
  const location = useLocation()
  useEffect(() => {
    const section = location.split('#')[1] ?? ''
    if (!SECTIONS.has(section)) return
    const scroll = (): boolean => {
      const target = document.getElementById(section)
      if (!target || target.closest('[hidden]')) return false
      target.scrollIntoView({ block: 'start' })
      return true
    }
    if (scroll()) return
    const observer = new MutationObserver(() => {
      if (scroll()) observer.disconnect()
    })
    observer.observe(document.getElementById('main') ?? document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden'] })
    return () => observer.disconnect()
  }, [location])
}
