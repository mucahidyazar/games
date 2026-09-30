import { setAnalyticsConsent, useAnalyticsConsent, type AnalyticsConsent } from '@/lib/analytics'

type ConsentActionsProps = {
  readonly consent: AnalyticsConsent
  readonly onClose?: () => void
}

function ConsentActions({ consent, onClose }: ConsentActionsProps) {
  return (
    <div className="mt-5 flex flex-wrap gap-2" role="group" aria-label="Analytics preference">
      <button
        type="button"
        onClick={() => {
          setAnalyticsConsent('granted')
          onClose?.()
        }}
        className="inline-flex min-h-10 items-center rounded-(--radius-control) bg-action px-4 text-[0.82rem] font-bold text-on-action transition hover:opacity-90"
      >
        {consent === 'granted' ? 'Analytics allowed' : 'Allow analytics'}
      </button>
      <button
        type="button"
        onClick={() => {
          setAnalyticsConsent('denied')
          onClose?.()
        }}
        className="inline-flex min-h-10 items-center rounded-(--radius-control) px-4 text-[0.82rem] font-semibold text-muted ring-1 ring-line transition hover:bg-sunken hover:text-ink"
      >
        {consent === 'denied' ? 'Analytics blocked' : 'Only necessary'}
      </button>
    </div>
  )
}

/** Re-openable, non-invasive analytics choices shown from Privacy settings. */
export function AnalyticsConsentPanel({ onClose }: { readonly onClose?: () => void }) {
  const consent = useAnalyticsConsent()
  return (
    <div className="prose-dialog">
      <p>
        We use optional, privacy-conscious analytics to understand which pages are useful. Analytics stays off until
        you explicitly choose “Allow analytics”. We send only the page path — never query strings, hashes, form values,
        email addresses, profiles or game replay data.
      </p>
      <p>
        Your choice is saved on this device and can be changed here at any time. Necessary cookies, such as the
        sign-in session, are not affected.
      </p>
      <ConsentActions consent={consent} onClose={onClose} />
    </div>
  )
}

/** First-visit notice. It disappears once a choice is saved and remains keyboard accessible. */
export function AnalyticsConsentBanner({ onOpenSettings }: { readonly onOpenSettings: () => void }) {
  const consent = useAnalyticsConsent()
  if (consent !== null) return null

  return (
    <aside
      aria-label="Privacy choices"
      className="fixed inset-x-3 bottom-3 z-40 mx-auto max-w-[680px] rounded-2xl border border-line bg-surface p-4 text-ink shadow-lift sm:inset-x-auto sm:right-5 sm:bottom-5 sm:p-5"
    >
      <h2 className="text-[0.95rem] font-extrabold">Privacy choices</h2>
      <p className="mt-1.5 max-w-[62ch] text-[0.8rem] leading-relaxed text-muted">
        Optional analytics helps us improve the games. Nothing is sent to Google until you allow it, and we send only
        page-view events without your game inputs. Google may use analytics cookies and device identifiers.
      </p>
      <ConsentActions consent={consent} />
      <button
        type="button"
        onClick={onOpenSettings}
        className="mt-2 inline-flex min-h-9 items-center rounded text-[0.76rem] font-semibold text-teal-700 underline-offset-4 hover:underline"
      >
        Privacy settings
      </button>
    </aside>
  )
}
