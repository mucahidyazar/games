import type { ReactNode } from 'react'
import { MountainsIcon, PhoneIcon, TabletPlayIcon } from '@/components/icons'

type StoreBadgeProps = {
  readonly platform: string
  readonly store: string
  readonly icon: ReactNode
}

function StoreBadge({ platform, store, icon }: StoreBadgeProps) {
  return (
    <li
      aria-disabled="true"
      className="relative flex min-w-[150px] flex-1 items-center gap-2.5 rounded-[10px] bg-sunken py-2 pr-4 pl-2.5 text-ink select-none sm:flex-none"
    >
      <span className="grid size-8 shrink-0 place-items-center rounded-[8px] bg-surface text-teal-300">{icon}</span>
      <span className="min-w-0 leading-tight">
        <span className="block text-[0.6rem] font-medium tracking-wide text-muted">{platform}</span>
        <span className="block text-[0.9rem] font-bold tracking-[-0.01em]">{store}</span>
      </span>
      <span className="absolute -top-1.5 -right-1.5 rounded-full bg-coral-600 px-1.5 py-px text-[0.56rem] font-extrabold tracking-wider text-white uppercase">
        Soon
      </span>
    </li>
  )
}

/**
 * Brand promo plus the upcoming iOS and Android apps (announced, not yet
 * downloadable — the badges are deliberately not links).
 */
export function AppDownloadStrip() {
  return (
    <section
      id="apps"
      aria-labelledby="apps-title"
      className="relative flex scroll-mt-20 flex-col gap-4 overflow-hidden rounded-[12px] border border-teal-100 bg-teal-50 px-5 py-4 sm:flex-row sm:items-center sm:gap-6"
    >
      <div className="flex items-center gap-4">
        <MountainsIcon className="h-8 w-12 shrink-0" />
        <p className="leading-tight">
          <span className="block text-[0.86rem] text-ink-soft">Small moves.</span>
          <span className="block text-[1.12rem] font-extrabold tracking-[-0.02em] text-teal-800">Bigger territory.</span>
        </p>
      </div>

      <div className="sm:ml-auto">
        <h2 id="apps-title" className="mb-2 text-[0.64rem] font-bold tracking-[0.12em] text-ink-soft uppercase">
          Mobile apps · coming soon
        </h2>
        <ul className="flex flex-wrap gap-2.5">
          <StoreBadge platform="iPhone & iPad" store="App Store" icon={<PhoneIcon className="size-[18px]" />} />
          <StoreBadge platform="Android" store="Google Play" icon={<TabletPlayIcon className="size-[18px]" />} />
        </ul>
      </div>
    </section>
  )
}
