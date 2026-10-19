import { t, type Localized } from './lang'

/** The shared chrome's words: header, footer and the controls in them. */
export const CHROME = {
  nav: {
    games: t('Oyunlar', 'Games'),
    categories: t('Kategoriler', 'Categories'),
    about: t('Hakkında', 'About'),
    allGames: t('Tüm oyunlar', 'All games'),
    play: t('Oyna', 'Play'),
    leaderboards: t('Sıralamalar', 'Leaderboards'),
    howToPlay: t('Nasıl oynanır', 'How to play'),
    moreGames: t('Daha fazla oyun', 'More games'),
    mobileApp: t('Mobil uygulama', 'Mobile app'),
    privacy: t('Gizlilik', 'Privacy'),
  },
  badges: { new: t('Yeni', 'New'), soon: t('Yakında', 'Soon') },
  footer: {
    play: t('Oyna', 'Play'),
    site: t('Site', 'Site'),
    privacy: t('Gizlilik', 'Privacy'),
    privacySettings: t('Gizlilik ayarları', 'Privacy settings'),
    links: t('bağlantıları', 'links'),
    portalTagline: t(
      'Tarayıcında anında açılan küçük, keskin oyunlar. İndirme yok, üyelik yok.',
      'Small, sharp games that run right in your browser. No download, no sign-up needed.',
    ),
    gameTagline: t(
      'Topları hapset, alanı kap. Tarayıcın için ücretsiz bir arcade oyunu; indirme ve üyelik gerekmez.',
      'Trap the orbs. Claim the space. A free arcade game for your browser — no download, no sign-up needed.',
    ),
    love: t('sevgi', 'love'),
  },
  header: {
    skip: t('İçeriğe geç', 'Skip to content'),
    home: t('Ana sayfa', 'Home'),
    homeLabel: t('ana sayfa', 'home'),
    playNow: t('hemen oyna', 'play now'),
    openMenu: t('Menüyü aç', 'Open menu'),
    closeMenu: t('Menüyü kapat', 'Close menu'),
    main: t('Ana menü', 'Main'),
    muteSound: t('Sesi kapat (M)', 'Mute sound (M)'),
    unmuteSound: t('Sesi aç (M)', 'Turn sound on (M)'),
    soundOn: t('Ses açık — kapatmak için M', 'Sound on — press M to mute'),
    soundOff: t('Ses kapalı — açmak için M', 'Sound off — press M to unmute'),
    language: t('Dil', 'Language'),
  },
  account: {
    signIn: t('Giriş yap', 'Sign in'),
    profile: t('Profilin', 'Your profile'),
  },
  theme: {
    navy: t('Lacivert', 'Navy Dark'),
    light: t('Açık', 'Light'),
    switchTo: t('temaya geç', 'theme'),
    current: t('Tema', 'Theme'),
  },
} as const

/** "Switch to Light theme" / "Açık temaya geç". */
export function switchThemeLabel(lang: 'tr' | 'en', target: Localized): string {
  return lang === 'tr' ? `${target.tr} ${CHROME.theme.switchTo.tr}` : `Switch to ${target.en} ${CHROME.theme.switchTo.en}`
}
