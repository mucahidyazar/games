import { t } from '@/app/lang'

/** The portal home's words in Turkish and English. */
export const PORTAL_COPY = {
  perks: {
    instant: { title: t('Anında oyna', 'Instant play'), text: t('İndirme yok, üyelik yok. Oyunu aç ve başla.', 'No download, no sign-up. Open a game and you’re in.') },
    fair: { title: t('Adil sıralamalar', 'Fair leaderboards'), text: t('Sabit kurallar, sunucuda doğrulanan oyunlar. Zirveye kestirme yok.', 'Fixed rules, server-verified runs. No shortcuts to the top.') },
    records: { title: t('Rekorlar ve rozetler', 'Records & badges'), text: t('Bir kez giriş yap, ilerlemen her oyunda seninle gelsin.', 'Sign in once and your progress follows you to every game.') },
  },
  hero: {
    eyebrow: t('Oyun salonu açık', 'The arcade is open'),
    lineOne: t('Anında oyna.', 'Play in seconds.'),
    lineTwo: t('Her hamle önemli.', 'Make it count.'),
    intro: t(
      'Mucahid’in yaptığı küçük, keskin oyunlar. Aşağıdan bir oyun seç ve hemen başla; indirme yok, üyelik yok.',
      'Small, sharp games built by Mucahid. Pick a game below and jump straight in — no download, no sign-up.',
    ),
    featured: t('Öne çıkan', 'Featured drop'),
    featuredGames: t('Öne çıkan oyunlar', 'Featured games'),
    scroll: t('Keşfetmek için kaydır', 'Scroll to explore'),
  },
  library: {
    eyebrow: t('Kütüphane', 'Library'),
    title: t('Sıradaki favorini bul', 'Find your next favourite'),
    categories: t('Kategoriler', 'Categories'),
    allGames: t('Tüm oyunlar', 'All games'),
  },
  empty: {
    title: (name: string) => t(`Henüz ${name.toLocaleLowerCase('tr-TR')} oyunu yok`, `No ${name.toLowerCase()} games yet`),
    text: (blurb: string, featured: string) => t(`${blurb} Başka bir kategoriye göz at ya da ${featured} oyununu dene.`, `${blurb} Explore another category or try ${featured}.`),
    play: (name: string) => t(`${name} oyna`, `Play ${name}`),
    showAll: t('Tüm oyunları göster', 'Show all games'),
  },
  daily: {
    eyebrow: t('Her gün yeni bir meydan okuma', 'A fresh challenge every day'),
    title: t('Bir gün. Tek şans.', 'One day. One shot.'),
    text: t('Herkes için aynı tahta. İlk dereceli oyununu değerlendir.', 'The same board for everyone. Make your first ranked run count.'),
    cta: t('Günlük meydan okumayı oyna', 'Play Daily Challenge'),
  },
  more: {
    eyebrow: t('Daha fazlasına yer var', 'Room for more'),
    titleOne: t('Küçük bir oyun salonu.', 'A small arcade.'),
    titleTwo: t('Daha yeni başlıyor.', 'Just getting started.'),
    text: t('Başlangıç için birkaç oyun. Daha fazla küçük kaçamak burada yerini bulacak.', 'A few games to get things rolling. More little escapes will find a home here.'),
    genres: t('Bulmaca · Strateji · Aksiyon · ve dahası', 'Puzzle · Strategy · Action · & more'),
  },
  account: {
    eyebrow: t('Hesabın', 'Your account'),
    title: t('Tek giriş, tüm sıralamalar.', 'One sign-in, every leaderboard.'),
    text: t(
      'Google ile ya da e-postana gelen kodla. Takma adın, rekorların ve rozetlerin buradaki her oyunda seninle.',
      'Google or a code sent to your email. Your nickname, records and badges follow you to every game here.',
    ),
    profile: t('Profilin', 'Your profile'),
    signIn: t('Giriş yap', 'Sign in'),
  },
  card: {
    play: (name: string) => t(`${name} oyna`, `Play ${name}`),
    featured: t('Öne çıkan', 'Featured'),
  },
  top: {
    title: t('Bu haftanın en iyileri', 'This week’s top players'),
    subtitle: (game: string) => t(`${game} · Klasik · yalnızca doğrulanmış oyunlar`, `${game} · Classic · verified runs only`),
    allBoards: t('Tüm tablolar', 'All boards'),
    loading: t('En iyi oyuncular yükleniyor', 'Loading top players'),
    error: t('Sıralama şu an yüklenemiyor. Yine de misafir olarak oynayabilirsin.', 'The leaderboard can’t be loaded right now. You can still play as a guest.'),
    retry: t('Tekrar dene', 'Try again'),
    empty: t('Bu hafta henüz doğrulanmış skor yok.', 'No verified scores yet this week.'),
    beFirst: t('İlk sen ol.', 'Be the first.'),
    level: (level: number) => t(`Seviye ${level}`, `Level ${level}`),
  },
} as const
