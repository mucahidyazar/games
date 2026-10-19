import { t, useLang } from '@/app/lang'
import { setAnalyticsConsent, useAnalyticsConsent, type AnalyticsConsent } from '@/lib/analytics'

const COPY = {
  preference: t('Analitik tercihi', 'Analytics preference'),
  allowed: t('Analitiğe izin verildi', 'Analytics allowed'),
  allow: t('Analitiğe izin ver', 'Allow analytics'),
  blocked: t('Analitik engellendi', 'Analytics blocked'),
  necessary: t('Yalnızca gerekli', 'Only necessary'),
  title: t('Gizlilik seçenekleri', 'Privacy choices'),
  banner: t(
    'İsteğe bağlı analitik, oyunları geliştirmemize yardımcı olur. Sen izin verene kadar Google’a hiçbir şey gönderilmez; izin verirsen de oyun hareketlerin olmadan yalnızca sayfa görüntüleme olayları gönderilir. Google analitik çerezleri ve cihaz tanımlayıcıları kullanabilir.',
    'Optional analytics helps us improve the games. Nothing is sent to Google until you allow it, and we send only page-view events without your game inputs. Google may use analytics cookies and device identifiers.',
  ),
  settings: t('Gizlilik ayarları', 'Privacy settings'),
  panelOne: t(
    'Hangi sayfaların işe yaradığını anlamak için isteğe bağlı, gizliliğe saygılı bir analitik kullanıyoruz. “Analitiğe izin ver” demediğin sürece analitik kapalı kalır. Yalnızca sayfa yolunu göndeririz; sorgu dizelerini, bağlantı parçalarını, form değerlerini, e-posta adreslerini, profilleri veya oyun kayıtlarını asla göndermeyiz.',
    'We use optional, privacy-conscious analytics to understand which pages are useful. Analytics stays off until you explicitly choose “Allow analytics”. We send only the page path — never query strings, hashes, form values, email addresses, profiles or game replay data.',
  ),
  panelTwo: t(
    'Seçimin bu cihazda saklanır ve buradan istediğin zaman değiştirilebilir. Oturum çerezi gibi gerekli çerezler bundan etkilenmez.',
    'Your choice is saved on this device and can be changed here at any time. Necessary cookies, such as the sign-in session, are not affected.',
  ),
} as const

type ConsentActionsProps = {
  readonly consent: AnalyticsConsent
  readonly onClose?: () => void
}

function ConsentActions({ consent, onClose }: ConsentActionsProps) {
  const lang = useLang()
  return (
    <div className="mt-5 flex flex-wrap gap-2" role="group" aria-label={COPY.preference[lang]}>
      <button
        type="button"
        onClick={() => {
          setAnalyticsConsent('granted')
          onClose?.()
        }}
        className="inline-flex min-h-10 items-center rounded-(--radius-control) bg-action px-4 text-[0.82rem] font-bold text-on-action transition hover:opacity-90"
      >
        {consent === 'granted' ? COPY.allowed[lang] : COPY.allow[lang]}
      </button>
      <button
        type="button"
        onClick={() => {
          setAnalyticsConsent('denied')
          onClose?.()
        }}
        className="inline-flex min-h-10 items-center rounded-(--radius-control) px-4 text-[0.82rem] font-semibold text-muted ring-1 ring-line transition hover:bg-sunken hover:text-ink"
      >
        {consent === 'denied' ? COPY.blocked[lang] : COPY.necessary[lang]}
      </button>
    </div>
  )
}

/** Re-openable, non-invasive analytics choices shown from Privacy settings. */
export function AnalyticsConsentPanel({ onClose }: { readonly onClose?: () => void }) {
  const consent = useAnalyticsConsent()
  const lang = useLang()
  return (
    <div className="prose-dialog">
      <p>{COPY.panelOne[lang]}</p>
      <p>{COPY.panelTwo[lang]}</p>
      <ConsentActions consent={consent} onClose={onClose} />
    </div>
  )
}

/** First-visit notice. It disappears once a choice is saved and remains keyboard accessible. */
export function AnalyticsConsentBanner({ onOpenSettings }: { readonly onOpenSettings: () => void }) {
  const consent = useAnalyticsConsent()
  const lang = useLang()
  if (consent !== null) return null

  return (
    <aside
      aria-label={COPY.title[lang]}
      className="fixed inset-x-3 bottom-3 z-40 mx-auto max-w-[680px] rounded-2xl border border-line bg-surface p-4 text-ink shadow-lift sm:inset-x-auto sm:right-5 sm:bottom-5 sm:p-5"
    >
      <h2 className="text-[0.95rem] font-extrabold">{COPY.title[lang]}</h2>
      <p className="mt-1.5 max-w-[62ch] text-[0.8rem] leading-relaxed text-muted">{COPY.banner[lang]}</p>
      <ConsentActions consent={consent} />
      <button
        type="button"
        onClick={onOpenSettings}
        className="mt-2 inline-flex min-h-9 items-center rounded text-[0.76rem] font-semibold text-teal-700 underline-offset-4 hover:underline"
      >
        {COPY.settings[lang]}
      </button>
    </aside>
  )
}
