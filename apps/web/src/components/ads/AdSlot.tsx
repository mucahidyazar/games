import { useEffect, useRef } from 'react'
import { siteConfig } from '@/lib/site'
import { logger } from '@/lib/logger'
import { loadAdSense } from './adsense'

type AdSlotProps = {
  readonly className?: string
}

type AdSenseUnitProps = {
  readonly client: string
  readonly slot: string
}

declare global {
  interface Window {
    adsbygoogle?: unknown[]
  }
}

/** Requests one AdSense ad for the <ins> element (guarded against StrictMode double effects). */
function AdSenseUnit({ client, slot }: AdSenseUnitProps) {
  const ref = useRef<HTMLModElement>(null)

  useEffect(() => {
    const element = ref.current
    if (!element || element.dataset.adRequested === 'true') return
    element.dataset.adRequested = 'true'
    loadAdSense(client)
    try {
      window.adsbygoogle = window.adsbygoogle ?? []
      window.adsbygoogle.push({})
    } catch (error: unknown) {
      logger.warn('AdSense could not fill the slot', error)
    }
  }, [client, slot])

  return (
    <ins
      ref={ref}
      className="adsbygoogle block min-h-[250px] w-full"
      data-ad-client={client}
      data-ad-slot={slot}
      data-ad-format="rectangle"
      data-full-width-responsive="true"
    />
  )
}

function AdPlaceholder() {
  const subject = encodeURIComponent(`${new URL(siteConfig.url).hostname} — Advertising inquiry`)
  const body = encodeURIComponent(`Hello,\n\nI'd like to advertise on ${siteConfig.url}.\n\nBrand / website:\nCampaign duration:\nMessage:\n`)
  return (
    <a
      href={`mailto:${siteConfig.contactEmail ?? 'mucahidyazar@gmail.com'}?subject=${subject}&body=${body}`}
      className="grid min-h-[250px] place-items-center rounded-[8px] border border-dashed border-line-strong bg-page px-6 py-5 text-center transition hover:border-action focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-action"
    >
      <div>
        <p className="text-[0.82rem] font-semibold text-ink-soft">Advertise here</p>
        <p className="mt-0.5 text-[0.7rem] text-subtle">Email us about advertising and sponsorship</p>
      </div>
    </a>
  )
}

/**
 * Sidebar advertisement. Renders a real AdSense unit once VITE_ADSENSE_CLIENT
 * and VITE_ADSENSE_SLOT_SIDEBAR are configured and explicitly enabled.
 * Otherwise, the placement opens an advertising inquiry in the visitor's mail app.
 */
export function AdSlot({ className = '' }: AdSlotProps) {
  const { client, sidebarSlot } = siteConfig.adsense
  const isConfigured =
    import.meta.env.VITE_ADSENSE_ENABLED?.trim().toLowerCase() === 'true' && client !== null && sidebarSlot !== null

  return (
    <aside aria-label="Advertisement" className={`card p-3 ${className}`}>
      <p className="mb-2 text-center text-[0.58rem] font-semibold tracking-[0.16em] text-subtle uppercase">
        Advertisement
      </p>
      {isConfigured ? <AdSenseUnit client={client} slot={sidebarSlot} /> : <AdPlaceholder />}
    </aside>
  )
}
