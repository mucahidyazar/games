import { useId } from 'react'

type LogoMarkProps = {
  readonly className?: string
}

/**
 * The Trap The Orb mark: an orange orb held back by a white wall inside the
 * teal field. Also the source for the favicon and app icons.
 */
export function LogoMark({ className }: LogoMarkProps) {
  const id = useId()
  const fieldId = `${id}-field`
  const orbId = `${id}-orb`

  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={fieldId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#16c7ba" />
          <stop offset="1" stopColor="#079c91" />
        </linearGradient>
        <radialGradient id={orbId} cx="0.36" cy="0.32" r="0.78">
          <stop offset="0" stopColor="#ffdcaa" />
          <stop offset="0.45" stopColor="#ff8c1a" />
          <stop offset="1" stopColor="#dd5a00" />
        </radialGradient>
      </defs>
      <rect x="1" y="1" width="38" height="38" rx="11" fill={`url(#${fieldId})`} />
      <path d="M26.2 7H30a3 3 0 0 1 3 3v20a3 3 0 0 1-3 3h-3.8Z" fill="#fff" fillOpacity="0.3" />
      <rect x="22.8" y="7" width="3.4" height="26" rx="1.7" fill="#fff" />
      <circle cx="13.6" cy="20" r="6.6" fill={`url(#${orbId})`} />
      <ellipse cx="11.5" cy="17.6" rx="2.1" ry="1.35" transform="rotate(-35 11.5 17.6)" fill="#fff" fillOpacity="0.85" />
    </svg>
  )
}

export function Logo() {
  return (
    <span className="flex items-center gap-2.5">
      <LogoMark className="size-7 shrink-0 lg:size-8" />
      <span className="text-[1.08rem] font-extrabold tracking-[-0.025em] whitespace-nowrap lg:text-[1.22rem]">
        <span className="text-ink">Trap The </span>
        <span className="text-teal-600">Orb</span>
      </span>
    </span>
  )
}
