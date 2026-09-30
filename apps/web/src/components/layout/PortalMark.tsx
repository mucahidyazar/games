import { useId } from 'react'

type PortalMarkProps = {
  readonly className?: string
}

/**
 * The games.mucahid.dev mark: a gamepad on a violet-to-teal tile. Also the
 * source for public/portal/favicon.svg and the portal icons; keep them in sync.
 */
export function PortalMark({ className }: PortalMarkProps) {
  const id = useId()
  const tileId = `${id}-tile`

  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={tileId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#8b5cf6" />
          <stop offset="1" stopColor="#0bb3a8" />
        </linearGradient>
      </defs>
      <rect x="1" y="1" width="38" height="38" rx="11" fill={`url(#${tileId})`} />
      <path
        d="M14 12h12a8 8 0 0 1 8 8v3.6a4.6 4.6 0 0 1-8.5 2.5l-1-1.6h-9l-1 1.6A4.6 4.6 0 0 1 6 23.6V20a8 8 0 0 1 8-8Z"
        fill="#fff"
      />
      <path d="M13.5 16v6.4M10.3 19.2h6.4" stroke="#0f2548" strokeOpacity="0.55" strokeWidth="2.2" strokeLinecap="round" />
      <circle cx="25.2" cy="17.6" r="1.7" fill="#0f2548" fillOpacity="0.55" />
      <circle cx="28.8" cy="21" r="1.7" fill="#0f2548" fillOpacity="0.55" />
    </svg>
  )
}
