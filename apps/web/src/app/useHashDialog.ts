import { useCallback, useEffect, useState } from 'react'
import { dialogFromHash, type DialogId } from './navigation'
import { NAVIGATE_EVENT } from './router'

export interface HashDialog {
  readonly active: DialogId | null
  open(id: DialogId): void
  close(): void
}

/**
 * Keeps the open dialog in the URL hash so dialogs are linkable
 * (e.g. `/#privacy`) and the browser back button closes them.
 */
export function useHashDialog(): HashDialog {
  const [active, setActive] = useState<DialogId | null>(() => dialogFromHash(window.location.hash))

  useEffect(() => {
    const onHashChange = (): void => setActive(dialogFromHash(window.location.hash))
    window.addEventListener('hashchange', onHashChange)
    window.addEventListener('popstate', onHashChange)
    window.addEventListener(NAVIGATE_EVENT, onHashChange)
    return () => {
      window.removeEventListener('hashchange', onHashChange)
      window.removeEventListener('popstate', onHashChange)
      window.removeEventListener(NAVIGATE_EVENT, onHashChange)
    }
  }, [])

  const open = useCallback((id: DialogId) => {
    if (window.location.hash === `#${id}`) setActive(id)
    else window.location.hash = id
  }, [])

  const close = useCallback(() => {
    if (dialogFromHash(window.location.hash)) {
      window.history.replaceState(window.history.state, '', window.location.pathname + window.location.search)
    }
    setActive(null)
  }, [])

  return { active, open, close }
}
