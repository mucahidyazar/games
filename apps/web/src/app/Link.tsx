import type { ComponentProps, MouseEvent } from 'react'
import { navigate } from './router'

type LinkProps = ComponentProps<'a'> & {
  readonly href: string
  /** Replace the current history entry (and keep the scroll position), e.g. for a choice within a page. */
  readonly replace?: boolean
}

const isModified = (event: MouseEvent): boolean => event.metaKey || event.ctrlKey || event.shiftKey || event.altKey

/** An anchor that navigates without reloading; new-tab and hash links behave natively. */
export function Link({ href, onClick, target, replace = false, ...rest }: LinkProps) {
  return (
    <a
      href={href}
      target={target}
      onClick={(event) => {
        onClick?.(event)
        if (event.defaultPrevented || event.button !== 0 || isModified(event) || target || href.startsWith('#')) return
        if (new URL(href, window.location.href).origin !== window.location.origin || rest.download !== undefined) return
        event.preventDefault()
        navigate(href, { replace })
      }}
      {...rest}
    />
  )
}
