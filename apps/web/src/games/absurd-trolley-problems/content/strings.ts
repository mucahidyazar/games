import { t } from '@/app/lang'
import type { AnyDilemma, Lang, Localized, TrolleyChoice } from './types'

/**
 * The game's own interface copy, in the site's language (Turkish or English,
 * see app/lang.ts).
 */

/**
 * The Turkish possessive suffix after a percentage, which follows how the
 * number is read aloud: %64'ü (altmış dördü), %81'i (seksen biri), %50'si.
 */
export function turkishPercentSuffix(value: number): string {
  const n = Math.abs(Math.round(value))
  const ones = ['ı', 'i', 'si', 'ü', 'ü', 'i', 'sı', 'si', 'i', 'u'] as const
  const tens = ['', 'u', 'si', 'u', 'ı', 'si', 'ı', 'i', 'i', 'ı'] as const
  if (n === 0) return 'ı'
  if (n % 100 === 0) return 'ü'
  if (n % 10 !== 0) return ones[n % 10] ?? 'i'
  return tens[Math.floor(n / 10) % 10] ?? 'u'
}

export function percent(lang: Lang, value: number): string {
  const n = Math.round(value)
  return lang === 'tr' ? `%${n}` : `${n}%`
}

export function count(lang: Lang, value: number): string {
  return value.toLocaleString(lang === 'tr' ? 'tr-TR' : 'en-US')
}

/** “Ayşe olarak devam et”. */
export function continueAs(lang: Lang, name: string): string {
  return lang === 'tr' ? `${name} olarak devam et` : `Continue as ${name}`
}

/** “Ayşe silinsin mi?” */
export function deleteQuestion(lang: Lang, name: string): string {
  return lang === 'tr' ? `${name} silinsin mi? Bütün seçimleri gider.` : `Delete ${name}? All their choices go too.`
}

/** A player's card: how far they are in each set, and how many they have run over. */
export function playerStats(lang: Lang, dilemmas: readonly [number, number], cases: readonly [number, number], kills: number): string {
  return lang === 'tr'
    ? `${dilemmas[0]}/${dilemmas[1]} ikilem · ${cases[0]}/${cases[1]} vaka · ${kills} kurban`
    : `${dilemmas[0]}/${dilemmas[1]} dilemmas · ${cases[0]}/${cases[1]} cases · ${kills} ${kills === 1 ? 'victim' : 'victims'}`
}

/** “%62 aynı fikirde”. */
export function agreementLine(lang: Lang, share: number): string {
  const value = Math.round(share * 100)
  return lang === 'tr' ? `%${value} aynı fikirde` : `${value}% in agreement`
}

/** “21 ortak ikilemin 13 tanesinde aynı seçim”. */
export function sharedLine(lang: Lang, same: number, shared: number): string {
  return lang === 'tr' ? `Ortak ${shared} ikilemin ${same} tanesinde aynı seçim` : `The same call on ${same} of ${shared} shared dilemmas`
}

/** Names for the avatar colours, for screen readers (same order as PLAYER_COLORS). */
export const COLOR_NAMES = [t('Nane', 'Mint'), t('Sarı', 'Yellow'), t('Pembe', 'Pink'), t('Mavi', 'Blue'), t('Mor', 'Purple'), t('Turuncu', 'Orange')] as const

export const VERDICTS = {
  twins: t('Ruh ikizi gibisiniz.', 'Practically twins.'),
  mostly: t('Çoğu zaman aynı raydasınız.', 'Mostly on the same track.'),
  apart: t('Raylarınız sık sık ayrılıyor.', 'Your tracks often part.'),
  opposites: t('Tam zıt kutuplarsınız!', 'Complete opposites!'),
} as const

/** Who ran over fewer: “Ayşe 4 can daha az kaybetti.” */
export function livesLine(lang: Lang, first: { readonly name: string; readonly kills: number }, second: { readonly name: string; readonly kills: number }): string {
  if (first.kills === second.kills) return lang === 'tr' ? 'İkiniz de aynı sayıda can kaybettiniz.' : 'You both lost the same number of lives.'
  const [kinder, other] = first.kills < second.kills ? [first, second] : [second, first]
  const difference = other.kills - kinder.kills
  return lang === 'tr' ? `${kinder.name} ${difference} can daha az kaybetti.` : `${kinder.name} lost ${difference} fewer ${difference === 1 ? 'life' : 'lives'}.`
}

/** What a choice is called on a dilemma's buttons: “Pull the lever”, “Push him”, “Refuse”… */
export function choiceName(lang: Lang, dilemma: AnyDilemma, choice: TrolleyChoice): string {
  return choice === 'pull' ? (dilemma.verbs?.pull[lang] ?? UI.pull[lang]) : (dilemma.verbs?.stay?.[lang] ?? UI.stay[lang])
}

/** “7 / 12 played”. */
export function playedCount(lang: Lang, played: number, total: number): string {
  return lang === 'tr' ? `${played} / ${total} oynandı` : `${played} of ${total} played`
}

/** What the reset buttons tell screen readers: always whose game it was. */
export const RESET_NOTES = {
  confirm: (lang: Lang, player: string, chapter: string): string =>
    lang === 'tr' ? `${player} için ${chapter} sıfırlansın mı? Onaylamak için tekrar bas.` : `Reset ${chapter} for ${player}? Press again to confirm.`,
  chapter: (lang: Lang, player: string, chapter: string): string => (lang === 'tr' ? `${player}: ${chapter} sıfırlandı.` : `${player}: ${chapter} has been reset.`),
  dilemma: (lang: Lang, player: string, title: string): string => (lang === 'tr' ? `${player}: “${title}” sıfırlandı.` : `${player}: “${title}” has been reset.`),
} as const

export const UI = {
  logo: t('ABSÜRT', 'ABSURD'),
  gameName: t('Absürt Tramvay Problemleri', 'Absurd Trolley Problems'),
  tabs: {
    play: t('Oyna', 'Play'),
    dilemmas: t('İkilemler', 'Dilemmas'),
    community: t('Topluluk', 'Community'),
    compare: t('Karşılaştır', 'Compare'),
  },
  tabsLabel: t('Oyun bölümleri', 'Game sections'),
  counterLabel: t('İkilem', 'Dilemma'),
  pull: t('Kolu çek', 'Pull the lever'),
  stay: t('Dokunma', 'Do nothing'),
  pulledVerb: t('kolu çekti', 'pulled the lever'),
  stayedVerb: t('dokunmadı', 'did nothing'),
  next: t('Sonraki ikilem', 'Next dilemma'),
  finish: t('Sonuçları gör', 'See your results'),
  youPulled: t('Sen kolu çektin.', 'You pulled the lever.'),
  youStayed: t('Sen dokunmadın.', 'You did nothing.'),
  youPushed: t('Sen adamı ittin.', 'You pushed him.'),
  waitingVote: t('Topluluğun oyları yükleniyor…', 'Loading the community’s votes…'),
  firstVote: t('İlk oyu sen verdin!', 'You cast the first vote!'),
  noCommunity: t('Topluluk sonuçları şu an yüklenemiyor.', 'Community results can’t be loaded right now.'),
  beforeChoice: t('Seçimini yap; topluluğun ne dediğini sonra göreceksin.', 'Make your choice; you’ll see what everyone else did afterwards.'),
  research: t('Araştırma', 'Research'),
  votes: t('oy', 'votes'),
  vote: t('oy', 'vote'),
  loadingScene: t('Sahne hazırlanıyor…', 'Setting the scene…'),
  sceneError: t('3D sahne bu tarayıcıda açılamadı; yine de oynayabilirsin.', 'The 3D scene couldn’t start in this browser, but you can still play.'),
  music: t('Müzik', 'Music'),
  kills: t('Kurban', 'Kills'),
  killCount: t('Toplam kurban sayısı', 'Kill count'),
  language: t('Dil', 'Language'),
  sceneLabel: t('Tramvay, makas ve raylardaki kurbanlar', 'The tram, the switch and the people on the tracks'),
  keyHint: t('Klavye: A kolu çeker, D dokunmaz, Enter sonraki ikileme geçer.', 'Keyboard: A pulls, D does nothing, Enter moves on.'),
  chapterDone: t('Bölüm tamamlandı', 'Chapter complete'),
  summaryTitle: t('Ahlaki profilin', 'Your moral profile'),
  livesLost: t('Kaybedilen can', 'Lives lost'),
  thingsLost: t('Feda edilen eşya', 'Things sacrificed'),
  pulls: t('Kolu çektin', 'Lever pulls'),
  agreement: t('Toplulukla aynı fikirde', 'Agreed with the majority'),
  playAgain: t('Bölümü tekrar oyna', 'Replay this chapter'),
  nextChapter: t('Bölüm 2’ye geç', 'Go to chapter 2'),
  backToStart: t('Bölüm 1’e dön', 'Back to chapter 1'),
  browse: t('İkilemlere göz at', 'Browse the dilemmas'),
  share: t('Sonucu kopyala', 'Copy my result'),
  copied: t('Kopyalandı!', 'Copied!'),
  notPlayed: t('Henüz oynamadın', 'Not played yet'),
  yourChoice: t('Senin seçimin', 'Your choice'),
  play: t('Bu ikilemi oyna', 'Play this dilemma'),
  seeResult: t('Sonucu gör', 'See the result'),
  resetDilemma: t('Sıfırla', 'Reset'),
  resetChapter: t('Bölümü sıfırla', 'Reset chapter'),
  confirmReset: t('Emin misin? Sıfırla', 'Sure? Reset it'),
  playFromStart: t('Baştan oyna', 'Play from the start'),
  playChapter: t('Bölümü oyna', 'Play this chapter'),
  communityTitle: t('Topluluk ne dedi?', 'What did everyone say?'),
  communityIntro: t('Her ikilemde kolu çekenlerin oranı. Oylar anonimdir; her oyuncu için tarayıcında yalnızca rastgele bir kimlik saklanır.', 'The share of players who pulled the lever on each dilemma. Votes are anonymous: your browser only keeps a random id for each player.'),
  // Choosing the problems: Philippa Foot's or the absurd ones.
  whichProblems: t('Hangi problemler?', 'Which problems?'),
  whichProblemsSetup: t('Tramvay probleminin aslı mı, absürt hâli mi? İstediğin zaman değiştirebilirsin.', 'The trolley problem as it began, or gone absurd? You can switch any time.'),
  begin: t('Başla', 'Start'),
  playersTitle: t('Oyuncular', 'Players'),
  setsLabel: t('Problemler', 'Problems'),
  // Players and the start screen.
  whoPlays: t('Kim oynuyor?', 'Who’s playing?'),
  whoPlaysSetup: t('Herkes kendi oyununu oynar; sonra Karşılaştır’da kimin kime benzediğini görün.', 'Everyone plays their own game; then see who thinks alike in Compare.'),
  newGame: t('Yeni oyun', 'New game'),
  newGameSetup: t('Eşin, annen, ev arkadaşın… Herkes kendi adıyla oynasın.', 'Your partner, your mum, your flatmate… everyone plays under their own name.'),
  newGameShort: t('Herkes kendi adıyla oynasın.', 'Everyone plays under their own name.'),
  yourName: t('Adın', 'Your name'),
  namePlaceholder: t('ör. Ayşe', 'e.g. Sam'),
  yourColor: t('Rengin', 'Your colour'),
  startGame: t('Başla', 'Start'),
  nameMissing: t('Bir isim yaz.', 'Type a name.'),
  nameTaken: t('Bu isimde bir oyuncu zaten var.', 'There’s already a player with that name.'),
  playersFull: t('En fazla 8 oyuncu olabilir; yer açmak için birini sil.', 'There can be 8 players at most; delete one to make room.'),
  lastPlayed: t('Son oynayan', 'Last played'),
  continueGame: t('Devam et', 'Continue'),
  deletePlayer: t('Sil', 'Delete'),
  cancel: t('Vazgeç', 'Cancel'),
  backToGame: t('Oyuna dön', 'Back to the game'),
  defaultPlayer: t('Oyuncu', 'Player'),
  switchPlayer: t('Oyuncu değiştir', 'Switch player'),
  playingAs: t('Oyuncu', 'Player'),
  noPlayerYet: t('Henüz bir oyun yok: önce kim oynuyor, onu seç.', 'No game yet: first say who’s playing.'),
  compareCta: t('Karşılaştır', 'Compare'),
  // Compare.
  compareTitle: t('Kim kime benziyor?', 'Who thinks alike?'),
  compareIntro: t('İki oyuncunun, ikisinin de oynadığı ikilemlerdeki seçimleri yan yana.', 'Two players’ choices, side by side, on the dilemmas they’ve both played.'),
  playerOne: t('1. oyuncu', 'Player one'),
  playerTwo: t('2. oyuncu', 'Player two'),
  needTwo: t('Karşılaştırmak için en az iki oyuncu gerekir.', 'You need at least two players to compare.'),
  noShared: t('Henüz ikinizin de oynadığı bir ikilem yok.', 'You haven’t both played the same dilemma yet.'),
  onlyDifferent: t('Sadece farklı seçtiklerinizi göster', 'Only show where you differ'),
  differ: t('Ayrıştınız', 'You differ'),
  agreed: t('Aynı seçim', 'Same call'),
  moralProfile: t('Ahlaki profil', 'Moral profile'),
  leverPulls: t('Kol çekme', 'Lever pulls'),
  totalVotes: t('Toplam oy', 'Total votes'),
  mostDivisive: t('En çok bölen', 'Most divisive'),
  mostPulled: t('En çok kolu çekilen', 'Most pulled'),
  leastPulled: t('En az kolu çekilen', 'Least pulled'),
  noVotesYet: t('Henüz oy yok', 'No votes yet'),
  noSplitYet: t('Henüz bölünen oy yok', 'No split votes yet'),
  pulledShort: t('kolu çekti', 'pulled'),
  dilemmasTitle: t('Bütün ikilemler', 'Every dilemma'),
  dilemmasIntro: t('İki bölüm, yirmi dört absürt karar. Oynadıkların burada seçiminle birlikte görünür.', 'Two chapters, twenty-four absurd decisions. The ones you’ve played show your choice.'),
} as const

/** The two sets of problems a player chooses between. */
export const MODES = {
  foot: {
    kicker: t('PHILIPPA FOOT · 1967', 'PHILIPPA FOOT · 1967'),
    name: t('Orijinal problemler', 'The original problems'),
    text: t(
      'Tramvay probleminin doğduğu 1967 makalesindeki vakalar: sürücü, yargıç, pilot, doktor ve ötekiler.',
      'The cases from the 1967 essay the trolley problem was born in: the driver, the judge, the pilot, the doctor and the rest.',
    ),
    meta: (lang: Lang, played: number, cases: number): string => (lang === 'tr' ? `${played} / ${cases} vaka oynandı` : `${played} of ${cases} cases played`),
  },
  absurd: {
    kicker: t('Absürt', 'Absurd'),
    name: t('Absürt ikilemler', 'Absurd dilemmas'),
    text: t('5 influencer mı, son kedi mi? 3D piksel bir dünyada saçma ama zor kararlar.', 'Five influencers or the last cat? Silly but hard calls in a 3D pixel world.'),
    meta: (lang: Lang, played: number, dilemmas: number): string => (lang === 'tr' ? `${played} / ${dilemmas} ikilem oynandı` : `${played} of ${dilemmas} dilemmas played`),
  },
} as const

/** Philippa Foot's problems: their own copy. */
export const FOOT_UI = {
  eyebrow: (lang: Lang, current: number, total: number): string => (lang === 'tr' ? `Philippa Foot · 1967 · Vaka ${current} / ${total}` : `Philippa Foot · 1967 · Case ${current} of ${total}`),
  counter: t('Vaka', 'Case'),
  casesTab: t('Vakalar', 'Cases'),
  changeSet: t('Problemler', 'Problems'),
  changeSetLabel: t('Başka problemler seç', 'Choose other problems'),
  keyHint: t('Klavye: A ilk seçenek, D ikincisi, Enter sonraki vakaya geçer.', 'Keyboard: A picks the first, D the second, Enter moves on.'),
  footSays: t('Foot ne derdi?', 'What would Foot say?'),
  same: t('Sen de aynı yolu seçtin.', 'You chose the same.'),
  different: t('Sen öbür yolu seçtin.', 'You chose the other way.'),
  open: t('Foot bu vakayı açık bıraktı.', 'Foot left this one open.'),
  next: t('Sonraki vaka', 'Next case'),
  victims: t('Kurban', 'Victims'),
  victimCount: t('Toplam kurban sayısı', 'Victim count'),
  // In the scenes.
  you: t('SEN', 'YOU'),
  noBrakes: t('FREN YOK!', 'NO BRAKES!'),
  guilty: t('SUÇLU', 'GUILTY'),
  free: t('SERBEST', 'FREE'),
  engineFire: t('MOTOR YANIYOR!', 'ENGINE FIRE!'),
  sceneLabel: t('Hareketli çizim: tramvay, makas ve raydakiler', 'Animated drawing: the tram, the switch and the people on the tracks'),
  pilotLabel: t('Hareketli çizim: düşen uçak, kalabalık mahalle ve tarladaki çiftçi', 'Animated drawing: the falling plane, the crowded town and the farmer in the field'),
  wardLabel: t('Hareketli çizim: hastane koğuşu, doktor ve hastalar', 'Animated drawing: the hospital ward, the doctor and the patients'),
  dungeonLabel: t('Hareketli çizim: zindan, hücreler ve tutsaklar', 'Animated drawing: the dungeon, its cells and the prisoners'),
  caveLabel: t('Hareketli çizim: su basan mağara ve çıkışa sıkışan adam', 'Animated drawing: the flooding cave and the man stuck in its mouth'),
  courtLabel: t('Hareketli çizim: adliye, yargıç, öfkeli kalabalık ve masum adam', 'Animated drawing: the courthouse, the judge, the angry crowd and the innocent man'),
  seaLabel: t('Hareketli çizim: fırtınada aşırı yüklü bir filika', 'Animated drawing: an overloaded lifeboat in a storm'),
  shopLabel: t('Hareketli çizim: gece bir bakkal dükkânı, zehirli yağ ve müşteriler', 'Animated drawing: a grocer’s shop at night, the poisoned oil and the customers'),
  homeLabel: t('Hareketli çizim: yoksul bir ev, aç çocuklar ve yiyecek taşıyan adam', 'Animated drawing: a poor home, the starving children and the man carrying food'),
  schoolLabel: t('Hareketli çizim: okul, öğrenciler ve istatistik panosu', 'Animated drawing: the school, its students and the statistics board'),
  theatreLabel: t('Hareketli çizim: ameliyathane, hasta, cerrah ve iki kalp monitörü', 'Animated drawing: the operating theatre, the patient, the surgeon and two heart monitors'),
  uncounted: t(
    'Bu vakada kurban sayılmaz: doğmamış çocuğun sayılıp sayılmayacağı, tartışmanın ta kendisi.',
    'Nobody is counted as a victim here: whether the unborn should count is the very question at issue.',
  ),
  storm: t('FIRTINA!', 'STORM!'),
  poison: t('ZEHİRLİ', 'POISON'),
  shopOpen: t('AÇIK', 'OPEN'),
  shopClosed: t('KAPANDI', 'CLOSED'),
  statistics: t('İSTATİSTİK', 'STATISTICS'),
  shelved: t('RAFA KALKTI', 'SHELVED'),
  // At the end.
  doneTitle: t('Foot ile karşılaştırma', 'You and Foot'),
  agreement: (lang: Lang, same: number, total: number): string => (lang === 'tr' ? `Foot’un cevap verdiği ${total} vakanın ${same} tanesinde onunla aynı yolu seçtin.` : `You sided with Foot on ${same} of the ${total} cases she answered.`),
  yourCall: t('Senin seçimin', 'Your call'),
  footsCall: t('Foot’un cevabı', 'Foot’s answer'),
  openCall: t('Açık bıraktı', 'Left open'),
  playAgain: t('Baştan oyna', 'Play again'),
  profileLabel: t('Profilin', 'Your profile'),
  sameAsFoot: t('vakada Foot’la aynı yol', 'cases on Foot’s side'),
  notPlayed: t('Oynanmadı', 'Not played'),
  principlesTitle: t('Foot’un ayrımına göre seçimlerin', 'Your calls, by Foot’s distinctions'),
  openCaseLabel: (lang: Lang, title: string): string => (lang === 'tr' ? `${title}: sonucu aç` : `${title}: open the result`),
  shareText: (lang: Lang, same: number, total: number, profile: string, url: string): string =>
    lang === 'tr'
      ? `Absürt Tramvay Problemleri · Philippa Foot: cevap verdiği ${total} vakanın ${same} tanesinde Foot’la aynı yolu seçtim. Profilim: “${profile}”. ${url}`
      : `Absurd Trolley Problems · Philippa Foot: I sided with Foot on ${same} of the ${total} cases she answered. My profile: “${profile}”. ${url}`,
  // The cases tab.
  casesTitle: t('Bütün vakalar', 'Every case'),
  casesIntro: t(
    'Philippa Foot’un 1967 makalesindeki yirmi bir seçim. Oynadıkların, seçiminle ve Foot’un cevabıyla burada görünür.',
    'The twenty-one choices in Philippa Foot’s 1967 essay. The ones you’ve played show your call and Foot’s.',
  ),
  resetCases: t('Vakaları sıfırla', 'Reset the cases'),
  playCase: t('Bu vakayı oyna', 'Play this case'),
  playCases: t('Vakaları oyna', 'Play the cases'),
  otherTitle: t('Makaledeki öteki vakalar', 'The essay’s other cases'),
  otherIntro: t(
    'Philippa Foot, “Kürtaj Sorunu ve Çifte Etki Öğretisi” (Oxford Review, 1967). Bunlar kimsenin önünde duran seçimler değil: Foot’un yapmak ile izin vermek arasına çizdiği çizginin örnekleri.',
    'Philippa Foot, “The Problem of Abortion and the Doctrine of the Double Effect” (Oxford Review, 1967). These are not choices anyone in them faces: they are the examples behind the line Foot draws between doing and allowing.',
  ),
  readEssay: t('Makaleyi oku', 'Read the essay'),
  // The community and compare tabs.
  communityIntro: t(
    'Foot’un her vakasında birinci seçeneği seçenlerin oranı. Oylar anonimdir; her oyuncu için tarayıcında yalnızca rastgele bir kimlik saklanır.',
    'The share of players who took the first option in each of Foot’s cases. Votes are anonymous: your browser only keeps a random id for each player.',
  ),
  mostFirst: t('Birinci seçenek en güçlü', 'First option strongest'),
  leastFirst: t('Birinci seçenek en zayıf', 'First option weakest'),
  firstOption: t('Birinci seçenek', 'First option'),
  compareIntro: t(
    'İki oyuncunun Foot’un vakalarındaki seçimleri yan yana. Philippa Foot’un kendisini de seçebilirsin.',
    'Two players’ calls on Foot’s cases, side by side. You can pick Philippa Foot herself, too.',
  ),
  /** “13 ortak vakanın 8 tanesinde aynı seçim”. */
  sharedLine: (lang: Lang, same: number, shared: number): string => (lang === 'tr' ? `Ortak ${shared} vakanın ${same} tanesinde aynı seçim` : `The same call on ${same} of ${shared} shared cases`),
  /** Who had fewer victims: “Ayşe 4 kurban daha az verdi.” */
  victimsLine: (lang: Lang, first: { readonly name: string; readonly kills: number }, second: { readonly name: string; readonly kills: number }): string => {
    if (first.kills === second.kills) return lang === 'tr' ? 'İkinizin de kurban sayısı aynı.' : 'You both had the same number of victims.'
    const [kinder, other] = first.kills < second.kills ? [first, second] : [second, first]
    const difference = other.kills - kinder.kills
    return lang === 'tr' ? `${kinder.name} ${difference} kurban daha az verdi.` : `${kinder.name} had ${difference} fewer ${difference === 1 ? 'victim' : 'victims'}.`
  },
} as const

export type FootProfileId = 'foot' | 'utilitarian' | 'absolutist' | 'own'

/** Where a player stands against Foot's essay, from their calls on her cases. */
export const FOOT_PROFILES: Readonly<Record<FootProfileId, { readonly title: Localized; readonly text: Localized }>> = {
  foot: {
    title: t('Foot’un izinde', 'In Foot’s footsteps'),
    text: t(
      'Zarar vermemeyi yardım etmekten daha katı bir görev saydın; sayılar ancak aynı türden görevler çatışınca devreye girdi. Tıpkı Foot gibi.',
      'You held not harming to be stricter than helping, and let the numbers decide only when duties of the same kind clashed. Just like Foot.',
    ),
  },
  utilitarian: {
    title: t('Faydacı', 'The utilitarian'),
    text: t(
      'Çoğu zaman, birine zarar vermek pahasına da olsa daha çok hayat kurtaran yolu seçtin. Foot’un zarar vermek ile yardım etmemek arasına çizdiği çizgi seni ikna etmedi.',
      'Most of the time you took whatever saved more lives, even at the cost of harming someone. Foot’s line between harming and failing to help didn’t convince you.',
    ),
  },
  absolutist: {
    title: t('Eli temiz', 'Clean hands'),
    text: t(
      'Foot’un bile en az zararı seçtiği yerlerde çoğu zaman hiçbir şeye dokunmadın. Senin için yapmak, izin vermekten çok daha ağır basıyor.',
      'Where even Foot would do the least harm, you mostly kept your hands off. For you, doing weighs far more than allowing.',
    ),
  },
  own: {
    title: t('Kendi yolunda', 'Your own way'),
    text: t(
      'Ne tam Foot’çu ne tam faydacı: her vakayı kendi içinde tarttın. Foot’un da dediği gibi, birçok vakada ne diyeceğimizi bilmek zor.',
      'Neither quite Foot nor quite a utilitarian: you weighed each case on its own. As Foot says herself, in many cases it is very hard to know what to say.',
    ),
  },
}

export type ArchetypeId = 'chaos' | 'lever' | 'bystander' | 'utilitarian' | 'herd' | 'contrarian' | 'grey'

export const ARCHETYPES: Readonly<Record<ArchetypeId, { readonly title: Localized; readonly text: Localized }>> = {
  chaos: {
    title: t('Kaos Ajanı', 'Agent of Chaos'),
    text: t('Seçim yaparken en çok neyin yanacağına baktın gibi. Felsefe hocaların seni izliyor.', 'You seem to pick whatever does the most damage. Your philosophy teachers are watching.'),
  },
  lever: {
    title: t('Kol Bağımlısı', 'Lever Addict'),
    text: t('Bir kol gördün mü çekiyorsun. Sonuçları sonra düşünürüz.', 'If there’s a lever, you pull it. Consequences can wait.'),
  },
  bystander: {
    title: t('Masum Seyirci', 'Innocent Bystander'),
    text: t('Kola neredeyse hiç dokunmadın. Ellerin temiz; vicdanın tartışılır.', 'You barely touched the lever. Clean hands, debatable conscience.'),
  },
  utilitarian: {
    title: t('Faydacı Hesap Makinesi', 'Utilitarian Calculator'),
    text: t('Hep daha az kaybı seçtin. Jeremy Bentham gurur duyardı.', 'You almost always chose the smaller loss. Jeremy Bentham would be proud.'),
  },
  herd: {
    title: t('Topluluğun Sesi', 'Voice of the People'),
    text: t('Neredeyse her seferinde çoğunlukla aynı tarafı seçtin.', 'You sided with the majority almost every time.'),
  },
  contrarian: {
    title: t('Aykırı Ruh', 'Contrarian'),
    text: t('Çoğunluk sağa dediğinde sen sola çektin.', 'When everyone went one way, you pulled the other.'),
  },
  grey: {
    title: t('Gri Alan', 'Grey Area'),
    text: t('Ne tam faydacı ne tam kuralcı. Her ikilemi kendi içinde tarttın.', 'Not quite a utilitarian, not quite a rule-follower. You judged each case on its own.'),
  },
}
