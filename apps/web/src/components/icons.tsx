import type { ReactNode, SVGProps } from 'react'

type IconProps = Omit<SVGProps<SVGSVGElement>, 'children'>

function Icon({ children, viewBox = '0 0 24 24', ...props }: IconProps & { children: ReactNode }) {
  return (
    <svg viewBox={viewBox} aria-hidden="true" focusable="false" {...props}>
      {children}
    </svg>
  )
}

const stroke = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const

export function PauseIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="5.5" y="4" width="4.6" height="16" rx="1.6" fill="currentColor" />
      <rect x="13.9" y="4" width="4.6" height="16" rx="1.6" fill="currentColor" />
    </Icon>
  )
}

export function PlayIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M7.5 4.8v14.4a1.3 1.3 0 0 0 2 1.1l11.2-7.2a1.3 1.3 0 0 0 0-2.2L9.5 3.7a1.3 1.3 0 0 0-2 1.1Z" fill="currentColor" />
    </Icon>
  )
}

export function RestartIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M19.4 8.5A8 8 0 1 0 20 13" {...stroke} strokeWidth={2.1} />
      <path d="M20 3.8v5h-5" {...stroke} strokeWidth={2.1} />
    </Icon>
  )
}

export function TrophyIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path
        d="M7 3h10v2h3.2a.8.8 0 0 1 .8.9c-.3 3.4-2.2 5.6-5.2 6.1A5.9 5.9 0 0 1 13 14.6V17h2.4a1.6 1.6 0 0 1 1.6 1.6V21H7v-2.4A1.6 1.6 0 0 1 8.6 17H11v-2.4A5.9 5.9 0 0 1 8.2 12C5.2 11.5 3.3 9.3 3 5.9a.8.8 0 0 1 .8-.9H7V3Zm0 3.8H5c.4 1.8 1.2 2.9 2.4 3.3A7 7 0 0 1 7 8V6.8Zm10 0V8c0 .7-.1 1.4-.4 2.1 1.2-.4 2-1.5 2.4-3.3h-2Z"
        fill="currentColor"
      />
    </Icon>
  )
}

export function BulbIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M9 18h6M10 21h4" {...stroke} />
      <path d="M12 3a6 6 0 0 0-3.6 10.8c.6.5 1 1.2 1 2V16h5.2v-.2c0-.8.4-1.5 1-2A6 6 0 0 0 12 3Z" {...stroke} />
    </Icon>
  )
}

export function ClockIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="9" {...stroke} strokeWidth={1.9} />
      <path d="M12 7.2V12l3.2 2.2" {...stroke} strokeWidth={1.9} />
    </Icon>
  )
}

export function HeartIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path
        d="M12 20.3 4.6 13a4.9 4.9 0 0 1 0-7 4.9 4.9 0 0 1 7 0l.4.4.4-.4a4.9 4.9 0 0 1 7 0 4.9 4.9 0 0 1 0 7L12 20.3Z"
        fill="currentColor"
      />
    </Icon>
  )
}

export function StarIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path
        d="m12 2.8 2.7 5.5 6 .9a.7.7 0 0 1 .4 1.2l-4.4 4.2 1 6a.7.7 0 0 1-1 .8L12 18.5l-5.4 2.9a.7.7 0 0 1-1-.8l1-6-4.3-4.2a.7.7 0 0 1 .4-1.2l6-.9L11.4 2.8a.7.7 0 0 1 1.2 0Z"
        fill="currentColor"
      />
    </Icon>
  )
}

export function ArrowRightIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M5 12h14M13 6l6 6-6 6" {...stroke} strokeWidth={2.2} />
    </Icon>
  )
}

export function VolumeOnIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 9.5v5a1 1 0 0 0 1 1h3l4.4 3.6a.8.8 0 0 0 1.3-.6V5.5a.8.8 0 0 0-1.3-.6L8 8.5H5a1 1 0 0 0-1 1Z" fill="currentColor" />
      <path d="M16.5 8.8a4.6 4.6 0 0 1 0 6.4M19 6.3a8.2 8.2 0 0 1 0 11.4" {...stroke} />
    </Icon>
  )
}

export function VolumeOffIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 9.5v5a1 1 0 0 0 1 1h3l4.4 3.6a.8.8 0 0 0 1.3-.6V5.5a.8.8 0 0 0-1.3-.6L8 8.5H5a1 1 0 0 0-1 1Z" fill="currentColor" />
      <path d="m17 9.5 5 5m0-5-5 5" {...stroke} />
    </Icon>
  )
}

export function MenuIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 7h16M4 12h16M4 17h16" {...stroke} />
    </Icon>
  )
}

export function CloseIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M6 6l12 12M18 6 6 18" {...stroke} strokeWidth={2.2} />
    </Icon>
  )
}

/** Double arrow showing the direction new walls will grow. */
export function WallDirectionIcon({ vertical, ...props }: IconProps & { vertical: boolean }) {
  return (
    <Icon {...props}>
      <g transform={vertical ? undefined : 'rotate(90 12 12)'}>
        <path d="M12 3.5v17M8 7.5l4-4 4 4M8 16.5l4 4 4-4" {...stroke} strokeWidth={2.2} />
      </g>
    </Icon>
  )
}

export function CheckIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="m5 12.5 4.3 4.3L19 7" {...stroke} strokeWidth={2.4} />
    </Icon>
  )
}

export function PhoneIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="6" y="2.5" width="12" height="19" rx="3" {...stroke} strokeWidth={1.8} />
      <path d="M10.5 18.2h3" {...stroke} strokeWidth={1.8} />
    </Icon>
  )
}

export function TabletPlayIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="5" y="2.5" width="14" height="19" rx="3" {...stroke} strokeWidth={1.8} />
      <path d="M10.5 9.3v5.4a.5.5 0 0 0 .8.4l4-2.7a.5.5 0 0 0 0-.8l-4-2.7a.5.5 0 0 0-.8.4Z" fill="currentColor" />
    </Icon>
  )
}

export function MountainsIcon(props: IconProps) {
  return (
    <Icon viewBox="0 0 64 40" {...props}>
      <defs>
        <linearGradient id="mountain-back" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#7fd9d0" />
          <stop offset="1" stopColor="#3cc8bd" />
        </linearGradient>
        <linearGradient id="mountain-front" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#14c2b6" />
          <stop offset="1" stopColor="#07a296" />
        </linearGradient>
      </defs>
      <path d="M2 36 19 8.6a2.3 2.3 0 0 1 3.9 0L40 36H2Z" fill="url(#mountain-back)" />
      <path d="m22 36 17-24.4a2.3 2.3 0 0 1 3.8 0L60 36H22Z" fill="url(#mountain-front)" />
    </Icon>
  )
}

export function ShareIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 3.5v11M7.5 8 12 3.5 16.5 8" {...stroke} />
      <path d="M8.5 11.5H7A2.5 2.5 0 0 0 4.5 14v4A2.5 2.5 0 0 0 7 20.5h10a2.5 2.5 0 0 0 2.5-2.5v-4a2.5 2.5 0 0 0-2.5-2.5h-1.5" {...stroke} />
    </Icon>
  )
}

export function FlagIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M5.5 21V4.5" {...stroke} strokeWidth={2.1} />
      <path d="M5.5 4.5h11.2a.6.6 0 0 1 .5.9l-2 3.4 2 3.4a.6.6 0 0 1-.5.9H5.5" fill="currentColor" />
    </Icon>
  )
}

export function ChevronDownIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="m6.5 9.5 5.5 5.5 5.5-5.5" {...stroke} strokeWidth={2.2} />
    </Icon>
  )
}

export function UserIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="8.2" r="3.9" {...stroke} strokeWidth={1.9} />
      <path d="M4.8 20.2a7.4 7.4 0 0 1 14.4 0" {...stroke} strokeWidth={1.9} />
    </Icon>
  )
}

export function MailIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="3.5" y="5.5" width="17" height="13" rx="2.5" {...stroke} strokeWidth={1.9} />
      <path d="m4.5 7.5 7.5 5.5 7.5-5.5" {...stroke} strokeWidth={1.9} />
    </Icon>
  )
}

/** Google's "G" mark, for the Google sign-in button only. */
export function GoogleIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path fill="#4285F4" d="M22.6 12.2c0-.8-.1-1.5-.2-2.2H12v4.2h5.9a5 5 0 0 1-2.2 3.3v2.7h3.6c2.1-1.9 3.3-4.8 3.3-8Z" />
      <path fill="#34A853" d="M12 23c3 0 5.5-1 7.3-2.7l-3.6-2.8c-1 .7-2.2 1.1-3.7 1.1-2.9 0-5.3-1.9-6.2-4.5H2.1v2.9A11 11 0 0 0 12 23Z" />
      <path fill="#FBBC05" d="M5.8 14.1a6.6 6.6 0 0 1 0-4.2V7H2.1a11 11 0 0 0 0 10l3.7-2.9Z" />
      <path fill="#EA4335" d="M12 5.4c1.6 0 3.1.6 4.2 1.7l3.2-3.2A11 11 0 0 0 2.1 7l3.7 2.9C6.7 7.3 9.1 5.4 12 5.4Z" />
    </Icon>
  )
}

export function ArrowLeftIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M19 12H5M11 6l-6 6 6 6" {...stroke} strokeWidth={2.2} />
    </Icon>
  )
}

export function ArrowUpRightIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M7 17 17 7M9 7h8v8" {...stroke} strokeWidth={2.2} />
    </Icon>
  )
}

export function GridIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="3.5" y="3.5" width="7" height="7" rx="2" {...stroke} strokeWidth={1.9} />
      <rect x="13.5" y="3.5" width="7" height="7" rx="2" {...stroke} strokeWidth={1.9} />
      <rect x="3.5" y="13.5" width="7" height="7" rx="2" {...stroke} strokeWidth={1.9} />
      <rect x="13.5" y="13.5" width="7" height="7" rx="2" {...stroke} strokeWidth={1.9} />
    </Icon>
  )
}

export function BoltIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M13 2.5 5 13.5h6l-1 8 8-11h-6l1-8Z" fill="currentColor" />
    </Icon>
  )
}

export function ShieldIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 3 4.5 6v5.5c0 4.6 3.2 8.4 7.5 9.5 4.3-1.1 7.5-4.9 7.5-9.5V6L12 3Z" {...stroke} strokeWidth={1.9} />
      <path d="m9 12 2 2 4-4.5" {...stroke} strokeWidth={2} />
    </Icon>
  )
}

export function MedalIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="14.5" r="5.5" {...stroke} strokeWidth={1.9} />
      <path d="m8.5 9.5-3-6h4l2.5 4.5L14.5 3.5h4l-3 6" {...stroke} strokeWidth={1.9} />
    </Icon>
  )
}
