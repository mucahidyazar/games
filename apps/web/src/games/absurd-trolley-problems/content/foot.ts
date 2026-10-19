import type { FootDilemmaId } from '@games/contract'
import { t, type Localized } from '@/app/lang'
import { CLOTH, HAIR, person, SKIN, strangers } from './cast'
import type { AnyChapter, Dilemma, PersonActor, ResearchFact, TrolleyChoice } from './types'

export type { FootDilemmaId }

/**
 * Philippa Foot, "The Problem of Abortion and the Doctrine of the Double
 * Effect", Oxford Review no. 5 (1967): the essay the trolley problem comes
 * from. Every case she uses is summarised here in our own words, with where
 * she comes down on it; the twenty-one that are choices can be played, in
 * motion. The four operations of the abortion debate are played too, but
 * nobody is counted as a victim in them: whether the unborn should count is
 * the very question the debate turns on, and the game takes no side.
 */

export const FOOT_SOURCE = { source: 'Philippa Foot, Oxford Review 5 (1967)', url: 'https://philpapers.org/rec/FOOTPO-2' } as const

export interface FootCase {
  readonly id: string
  readonly title: Localized
  readonly summary: Localized
  /** What Foot concludes, or leaves open. */
  readonly verdict: Localized
  /** The playable case it became, if it is a choice someone can make. */
  readonly play?: FootDilemmaId
}

export const FOOT_CASES: readonly FootCase[] = [
  {
    id: 'tram',
    play: 'foot-driver',
    title: t('Kontrolden çıkan tramvay', 'The runaway tram'),
    summary: t(
      'Frenleri tutmayan tramvayın sürücüsü onu yalnızca bir raydan diğerine çevirebilir: birinde beş, ötekinde bir işçi çalışıyor.',
      'The driver of a runaway tram can only steer it from one narrow track to another: five men work on one, one man on the other.',
    ),
    verdict: t('Çevirmeli: iki taraf da “zarar vermeme” görevi; en az zararı seçmeli.', 'Steer: both sides are duties not to harm, so do the least harm.'),
  },
  {
    id: 'judge',
    play: 'foot-judge',
    title: t('Yargıç ve isyancılar', 'The judge and the rioters'),
    summary: t(
      'Beş rehine tutan isyancılar bir suçlu bulunmazsa kan dökeceklerini söylüyor; yargıç ancak bir masumu suçlayıp idam ettirerek bunu önleyebilir.',
      'Rioters holding five hostages will take bloody revenge unless a culprit is found; the judge can stop them only by framing an innocent man and having him executed.',
    ),
    verdict: t('Suçlamamalı: birine zarar vererek başkalarına yardım etmek, zararlar arasında seçim yapmakla aynı değil.', 'Don’t: harming one to help others is not the same as choosing between harms.'),
  },
  {
    id: 'pilot',
    play: 'foot-pilot',
    title: t('Düşen uçağın pilotu', 'The falling plane'),
    summary: t('Uçağı düşmek üzere olan pilot onu kalabalık bir bölgeden daha tenha bir bölgeye yönlendirebilir.', 'A pilot whose plane is about to crash can steer it from a more to a less inhabited area.'),
    verdict: t('Tramvay gibi: yönlendirmeli.', 'Like the tram: steer.'),
  },
  {
    id: 'drug',
    play: 'foot-drug',
    title: t('Kıt ilaç', 'The scarce drug'),
    summary: t(
      'Bir hastanın yaşaması için ilacın tamamı gerekiyor; o sırada gelen beş hastanın her birini beşte biri kurtarabilir.',
      'One patient needs a whole supply of a drug to live; five others who arrive could each be saved by a fifth of it.',
    ),
    verdict: t('Beşini kurtarmalı: burada yardımla yardım tartılıyor.', 'Save the five: this weighs aid against aid.'),
  },
  {
    id: 'crash',
    play: 'foot-crash',
    title: t('Koğuş ve çoklu kaza', 'The ward and the multiple crash'),
    summary: t(
      'Koğuşun bütün imkânları tek bir ağır hastaya mı ayrılmalı, yoksa ambulansların getirdiği çoklu kaza yaralılarına mı?',
      'Should a whole ward’s resources go to one dangerously ill patient, or to the victims of a multiple crash the ambulances bring in?',
    ),
    verdict: t('Yaralılara: kıt ilaç gibi, yardım ile yardım tartılıyor.', 'The crash victims: as with the drug, aid is weighed against aid.'),
  },
  {
    id: 'serum',
    play: 'foot-serum',
    title: t('Bir bedenden serum', 'A serum from a body'),
    summary: t(
      'Ağır hasta birkaç kişi, ancak biri öldürülüp bedeninden serum yapılırsa kurtulabilir; organ nakli için “yedek parça” da aynı soru.',
      'Several dying people can be saved only by killing someone and making a serum from his body; taking “spare parts” for transplants is the same question.',
    ),
    verdict: t('Hayır: başkalarına yardım için birine zarar vermek olur.', 'No: it injures one to bring aid to others.'),
  },
  {
    id: 'beggar',
    play: 'foot-beggar',
    title: t('Dilenci', 'The beggar'),
    summary: t(
      'Kapıdaki aç dilenciye yemek vermek yerine, tıbbi araştırma için bedenlere ihtiyaç var diye ölmesine göz yummak.',
      'Letting the starving beggar at the door die instead of feeding him, because bodies are needed for medical research.',
    ),
    verdict: t('Yanlış: ölümünü amaçlayarak ölmesine izin vermek, zarar vermek sayılır.', 'Wrong: letting him die while aiming at his death counts as harming him.'),
  },
  {
    id: 'gas',
    play: 'foot-gas',
    title: t('Hastanedeki gaz', 'The hospital gas'),
    summary: t(
      'Beş hastayı kurtaracak bir gaz üretilebilir, ama zehirli dumanı yerinden kıpırdatılamayan başka bir hastanın odasına dolacak.',
      'A gas that would save five patients can be made, but its fumes would fill the room of another patient who cannot be moved.',
    ),
    verdict: t('Hayır, ölümü yalnızca bir yan etki olsa bile.', 'No, even though his death would only be a side effect.'),
  },
  {
    id: 'rescue',
    play: 'foot-rescue',
    title: t('Beş mi, bir mi kurtarılır?', 'Rescue five or one?'),
    summary: t('Tiranın işkencecilerinden ya beş kişiyi ya da bir kişiyi kurtarabiliriz.', 'We can rescue either five people or one from the tyrant’s torturers.'),
    verdict: t('Beşini kurtarmalı: yardım ederken büyük grubu seçeriz.', 'Rescue the five: when bringing aid, help the larger group.'),
  },
  {
    id: 'tyrant',
    play: 'foot-tyrant',
    title: t('Tehdit eden tiran', 'The tyrant’s threat'),
    summary: t('Bir tiran, biz bir kişiye işkence etmezsek beş kişiye işkence edeceğini söylüyor.', 'A tyrant will torture five people unless we torture one.'),
    verdict: t('Reddetmeli: zarar vermemek, başkasının zararını önlemekten daha katı bir görev.', 'Refuse: not harming is a stricter duty than stopping others from harming.'),
  },
  {
    id: 'murderer',
    play: 'foot-madman',
    title: t('Sözünü tutan katil', 'The murderer who keeps his word'),
    summary: t('Sözünü hep tutan bir katil, biz masum birini öldürmezsek iki kişiyi öldürecek.', 'A madman known to keep his promises will kill two people unless we kill one innocent.'),
    verdict: t('Reddetmeli: kötü insanların tehditleri bizi harekete zorlayamaz.', 'Refuse: bad people’s threats cannot force our hand.'),
  },
  {
    id: 'children',
    play: 'foot-children',
    title: t('Aç çocuklar', 'The starving children'),
    summary: t('Kendi aç çocuklarına yiyecek götürmek için bir cinayet işlemek.', 'Committing a murder to bring one’s starving children food.'),
    verdict: t('Hayır: en güçlü yardım görevi bile zarar vermemenin önüne geçmez.', 'No: even the strictest duty to help does not outweigh the duty not to harm.'),
  },
  {
    id: 'oil',
    play: 'foot-oil',
    title: t('Zehirli yemeklik yağ', 'The poisoned cooking oil'),
    summary: t(
      'Tüccarlar zehirli olduğunu bildikleri yağı kâr için satar; işsiz mezarcılar aynı yağı iş çıksın diye satar.',
      'Merchants sell cooking oil they know is poisonous, for profit; out-of-work gravediggers sell the same oil to drum up burials.',
    ),
    verdict: t('İkisi de katil: ölümleri “yalnızca öngörmek” bir mazeret değil.', 'Both are murderers: merely foreseeing the deaths is no excuse.'),
  },
  {
    id: 'statistics',
    play: 'foot-education',
    title: t('Eğitim ve istatistik', 'Education and statistics'),
    summary: t(
      'Eğitim seviyesini yükseltmek, intihar oranının artacağı öngörülse de kabul görür; ama kanser araştırması için insan öldürmek asla.',
      'Raising a country’s level of education is accepted even if statistics predict more suicides; killing people for cancer research never is.',
    ),
    verdict: t('Makalenin çıkış noktası: sezgilerimiz net ama ilke belirsiz.', 'Her starting point: our intuitions are clear, the principle is not.'),
  },
  {
    id: 'cave',
    play: 'foot-cave',
    title: t('Mağaradaki şişman adam: başı dışarıda', 'The fat man in the cave: head outside'),
    summary: t(
      'Mağaradan çıkarken yolu gösteren iri adam ağza sıkışır; su yükselir. Ya dinamitle onu patlatırlar ya da beklerler: o sonra kurtarılır, ötekiler boğulur.',
      'Leading a party out of a cave, a fat man gets stuck in its mouth as flood water rises. They can blast him out with dynamite, or wait: he will be rescued in due course, and the rest will drown.',
    ),
    verdict: t('Açık bırakır; tehdidin onun varlığından gelmesinin fark yaratabileceğini söyler.', 'Left open; she notes it may matter that his presence is the threat.'),
  },
  {
    id: 'cave-inside',
    play: 'foot-cave-inside',
    title: t('Mağaradaki şişman adam: başı içeride', 'The fat man in the cave: head inside'),
    summary: t('Aynı mağara, ama adamın başı içeride: beklerlerse o da ötekilerle birlikte boğulacak.', 'The same cave, but his head is inside: if they wait, he will drown with the rest.'),
    verdict: t('Patlatmak makul: o her durumda ölecek; birilerini kurtaracak olan yapılmalı.', 'Blasting is reasonable: he will die either way, so what saves someone should be done.'),
  },
  {
    id: 'lifeboat',
    play: 'foot-lifeboat',
    title: t('Batan filika', 'The sinking lifeboat'),
    summary: t(
      'Fırtınada birini denize atmazlarsa batacaklarına inanan denizciler; bir de sandalda aç kalıp miçoyu öldürüp yiyen Dudley ile Stephens.',
      'Shipwrecked mariners who believe they must throw someone overboard or founder in the storm; and Dudley and Stephens, who killed and ate their cabin boy when adrift without food.',
    ),
    verdict: t('Hiç kimseyi kurtarmamaktansa birini kurtarmak daha iyi; ama geri durana da saygı duyulur.', 'Better to save some than none, though one would respect someone who held back.'),
  },
  {
    id: 'hysterectomy',
    play: 'foot-hysterectomy',
    title: t('Kanserli rahim', 'The cancerous womb'),
    summary: t(
      'Hamile bir hastanın kanserli rahmi alınırsa hasta yaşar, cenin ölür; alınmazsa ikisi de ölür. Çifte etki öğretisi bu ameliyata izin verir.',
      'If a pregnant patient’s cancerous womb is removed, she lives and the foetus dies; if not, both die. The doctrine of double effect allows this operation.',
    ),
    verdict: t('Ameliyat edilmeli; ama gerekçe çifte etki değil, ikisinin de ölecek olması.', 'Operate; not because of double effect, but because both would die.'),
  },
  {
    id: 'craniotomy',
    play: 'foot-craniotomy',
    title: t('Doğumda kraniyotomi', 'Craniotomy in labour'),
    summary: t(
      'Doğum tıkanmıştır; bebeğin ölümüne yol açan bir ameliyat anneyi kurtarabilir, yapılmazsa ikisi de ölür. Çifte etki öğretisi bu ameliyatı yasaklar.',
      'The labour is obstructed; an operation that ends the baby’s life can save the mother, and without it both die. The doctrine of double effect forbids this operation.',
    ),
    verdict: t('Ameliyat edilebilir: ikisi de ölecekse yöntem fark etmez.', 'It may be done: if both would die, the method makes no difference.'),
  },
  {
    id: 'mother-or-child',
    play: 'foot-mother-or-child',
    title: t('Anne mi, bebek mi?', 'Mother or baby?'),
    summary: t('Bir ameliyat ya anneyi ya da bebeği kurtarabilir; hiçbir şey yapılmazsa ikisi de ölür.', 'An operation can save either the mother or the baby; if nothing is done, both die.'),
    verdict: t('Harekete geçmek makul; muhtemelen anneden yana karar verilir.', 'Acting is reasonable; probably the decision goes to the mother.'),
  },
  {
    id: 'worst-dilemma',
    play: 'foot-worst-dilemma',
    title: t('En zor ikilem', 'The worst dilemma'),
    summary: t(
      'Anneyi yalnızca bebeğin ölümüne yol açan bir ameliyat kurtarabilir; yapılmazsa anne ölür, bebek ondan sonra sağ salim doğurtulur.',
      'Only an operation that ends the baby’s life can save the mother; without it the mother dies, and the baby is safely delivered afterwards.',
    ),
    verdict: t('Açık bırakır: bu görüşlerden hiçbirini savunmadığını söyler.', 'Left open: she says she argues for none of the views.'),
  },
  {
    id: 'relatives',
    title: t('Aç bırakılan aile', 'A family left to starve'),
    summary: t(
      'Çocuğunu ya da yaşlı akrabalarını aç bırakıp ölmelerine izin veren de, onları zehirleyen kadar katildir; ahlakta da hukukta da.',
      'A man may murder his child or his aged relatives by letting them starve as surely as by poisoning them, in morality and in law.',
    ),
    verdict: t('Bazen izin vermek de yapmak kadar kötüdür.', 'Sometimes allowing is as bad as doing.'),
  },
  {
    id: 'far-away',
    title: t('Uzak ülkelerdeki açlık', 'Starvation far away'),
    summary: t(
      'Çoğumuz uzak ülkelerde insanların açlıktan ölmesine izin veriyoruz ve bunda yanlış bir şey var; yine de bu, onlara zehirli yiyecek göndermekle bir değil.',
      'Most of us let people starve in faraway countries, and there is surely something wrong with us that we do; yet it is not the same as sending them poisoned food.',
    ),
    verdict: t(
      'Çözümünün temeli: insanlara yardım olarak borçlu olduklarımız, onlara karışmamak olarak borçlu olduklarımızla aynı ağırlıkta değil.',
      'The key to her answer: what we owe people in the way of aid does not weigh the same as what we owe them in the way of non-interference.',
    ),
  },
  {
    id: 'allowing',
    title: t('İzin vermenin iki yolu', 'Two ways of allowing'),
    summary: t(
      'Önlemekten kaçınmak (bir hayvanı aç bırakmak, birini tuzağa yürümeye bırakmak) ya da engeli kaldırmak (tıpayı çekip suyu akıtmak, kapıyı açıp hayvanı salıvermek).',
      'Forbearing to prevent (letting an animal starve, letting someone walk into a trap), or removing an obstacle (pulling a plug so the water flows, opening a door so an animal gets out).',
    ),
    verdict: t(
      'Foot ilkiyle ilgilenir ve yapmak ile izin vermek arasındaki ayrımın, doğrudan ve dolaylı niyet ayrımıyla aynı olmadığını gösterir.',
      'Foot is concerned with the first, and shows that the line between doing and allowing is not the line between direct and oblique intention.',
    ),
  },
]

export type FootDilemma = Dilemma<FootDilemmaId>

const fact = (tr: string, en: string): ResearchFact => ({ text: { tr, en }, ...FOOT_SOURCE })

const worker = (top: string, skin: string, hairColor: string): PersonActor =>
  person({ top, bottom: CLOTH.denim, skin, hairColor, accessories: ['cap'], hatColor: '#f2c14e', pose: 'hold' })

const GOWN = '#cfe3f2'
const patient = (skin: string, hair: PersonActor['hair'], hairColor: string): PersonActor =>
  person({ top: GOWN, bottom: GOWN, shoes: '#dfe7f0', skin, hair, hairColor })

const prisoner = (skin: string, hair: PersonActor['hair'], hairColor: string): PersonActor =>
  person({ top: '#8a7a66', bottom: '#5d5246', shoes: '#3b342c', skin, hair, hairColor })

const caver = (top: string, skin: string, hairColor: string): PersonActor =>
  person({ top, bottom: CLOTH.khaki, skin, hairColor, accessories: ['cap'], hatColor: '#f08a3c' })

const castaway = (top: string, skin: string, hair: PersonActor['hair'], hairColor: string): PersonActor =>
  person({ top, bottom: CLOTH.navy, shoes: '#2a2b33', skin, hair, hairColor })

const child = (top: string, hair: PersonActor['hair'], scale: number): PersonActor =>
  person({ top, bottom: CLOTH.denim, skin: SKIN.light, hair, hairColor: HAIR.brown, scale })

const FIVE_PATIENTS = [
  patient(SKIN.fair, 'short', HAIR.grey),
  patient(SKIN.medium, 'long', HAIR.black),
  patient(SKIN.tan, 'bald', HAIR.black),
  patient(SKIN.light, 'bun', HAIR.chestnut),
  patient(SKIN.deep, 'short', HAIR.black),
]

const FIVE_PRISONERS = [
  prisoner(SKIN.light, 'messy', HAIR.brown),
  prisoner(SKIN.medium, 'short', HAIR.black),
  prisoner(SKIN.fair, 'long', HAIR.blonde),
  prisoner(SKIN.deep, 'bald', HAIR.black),
  prisoner(SKIN.tan, 'spiky', HAIR.black),
]

const FIVE_CAVERS = [caver(CLOTH.green, SKIN.fair, HAIR.brown), caver(CLOTH.blue, SKIN.medium, HAIR.black), caver(CLOTH.purple, SKIN.light, HAIR.blonde), caver(CLOTH.teal, SKIN.deep, HAIR.black), caver(CLOTH.pink, SKIN.tan, HAIR.chestnut)]

/** The large man stuck in the cave's mouth, in both of Foot's versions. */
const STUCK = person({ top: CLOTH.red, bottom: CLOTH.khaki, hair: 'bald', hairColor: HAIR.brown, skin: SKIN.light, accessories: ['beard'], scale: 1.25 })

/** The one the others would throw overboard. */
const OVERBOARD = castaway(CLOTH.yellow, SKIN.medium, 'short', HAIR.black)

const verbs = (pull: Localized, pulled: Localized, stay: Localized, youPull: Localized, youStay: Localized): FootDilemma['verbs'] => ({
  pull,
  pulled,
  stay,
  you: { pull: youPull, stay: youStay },
})

/**
 * The seventeen of Foot's cases that are choices, in the order they are
 * played: her pairs side by side, the essay's opening intuitions after the
 * threats, and the cases she sets beside the abortion debate last.
 */
export const FOOT_DILEMMAS: readonly FootDilemma[] = [
  {
    id: 'foot-driver',
    title: t('Tramvayı sen sürüyorsun: 5 işçi mi, 1 işçi mi?', 'You drive the tram: five workers or one?'),
    setup: t('Frenler tutmuyor. Önündeki rayda beş, yan rayda bir işçi çalışıyor.', 'The brakes have failed. Five men work on the track ahead, one on the side track.'),
    trackA: [worker(CLOTH.orange, SKIN.medium, HAIR.black), worker(CLOTH.orange, SKIN.fair, HAIR.brown), worker(CLOTH.yellow, SKIN.tan, HAIR.black), worker(CLOTH.orange, SKIN.light, HAIR.ginger), worker(CLOTH.yellow, SKIN.deep, HAIR.black)],
    trackB: [worker(CLOTH.orange, SKIN.light, HAIR.chestnut)],
    outcome: {
      pull: t('Beş işçi kurtuldu; yan raydaki işçi kurtulamadı.', 'The five are safe; the man on the side track is not.'),
      stay: t('Yan raydaki işçi kurtuldu; beş işçi kurtulamadı.', 'The man on the side track is safe; the five are not.'),
    },
    verbs: verbs(t('Direksiyonu kır', 'Steer away'), t('direksiyonu kırdı', 'steered away'), t('Düz devam et', 'Keep straight'), t('Direksiyonu kırdın.', 'You steered away.'), t('Düz devam ettin.', 'You kept straight.')),
    fact: fact(
      'Foot’a göre sürücü iki “zarar vermeme” görevi arasında kalmıştır: beşine de birine de zarar vermemesi gerekir. İkisini birden yapamadığı için en az zararı seçmelidir.',
      'For Foot, the driver is caught between two duties not to harm: he must not injure the five, nor the one. Since he cannot avoid both, he should do the least harm.',
    ),
  },
  {
    id: 'foot-judge',
    title: t('Yargıç sensin: bir masumu mu suçlarsın, beş rehineyi mi kaybedersin?', 'You are the judge: frame an innocent man, or lose five hostages?'),
    setup: t('Öfkeli kalabalık bir suçlu istiyor ve beş rehine tutuyor. Gerçek suçlu bilinmiyor.', 'An angry mob demands a culprit and holds five hostages. Nobody knows who really did it.'),
    trackA: strangers(5, 2).map((stranger) => ({ ...stranger, marker: 'exclaim' as const })),
    trackB: [person({ top: CLOTH.white, bottom: CLOTH.charcoal, hair: 'short', hairColor: HAIR.brown, accessories: ['tie'], marker: 'question' })],
    outcome: {
      pull: t('Kalabalık dağıldı, rehineler serbest; ama masum bir adam cezalandırıldı.', 'The mob went home and freed the hostages, but an innocent man paid for it.'),
      stay: t('Masum adam serbest kaldı; ama öfkeli kalabalık rehinelere saldırdı.', 'The innocent man walked free, but the mob turned on the hostages.'),
    },
    verbs: verbs(t('Masumu suçla', 'Frame him'), t('masumu suçladı', 'framed the innocent man'), t('Reddet', 'Refuse'), t('Masumu suçladın.', 'You framed him.'), t('Reddettin.', 'You refused.')),
    fact: fact(
      'Foot’a göre yargıç, zarar vermeme görevini yardım etme göreviyle tartıyor; birine zarar vermemek daha katı bir görev olduğu için masumu suçlayamaz. Bunu yapan yargıç değil sıradan biri olsa da aynı dehşeti duyarız.',
      'For Foot, the judge weighs the duty not to harm against the duty to help; not harming is the stricter one, so he may not frame the innocent man. Were it a private citizen rather than a judge, we would be just as horrified.',
    ),
  },
  {
    id: 'foot-pilot',
    title: t('Pilot sensin: kalabalık mahalle mi, ıssız tarla mı?', 'You fly the plane: the crowded town or the empty field?'),
    setup: t('Motor yandı, uçak düşüyor. Onu ancak kalabalık bir mahalleden daha tenha bir yere yönlendirebilirsin.', 'The engine is on fire and the plane is going down. All you can do is steer it from a crowded town to an emptier place.'),
    trackA: strangers(5, 4),
    trackB: [person({ top: CLOTH.green, bottom: CLOTH.denim, hair: 'short', hairColor: HAIR.brown, accessories: ['cap'], hatColor: '#c9a36b', skin: SKIN.tan })],
    outcome: {
      pull: t('Mahalle kurtuldu; tarladaki çiftçi kurtulamadı.', 'The town is spared; the farmer in the field is not.'),
      stay: t('Tarladaki çiftçi kurtuldu; mahallede beş kişi kurtulamadı.', 'The farmer is spared; five people in the town are not.'),
    },
    verbs: verbs(t('Tarlaya yönlendir', 'Steer for the field'), t('tarlaya yönlendirdi', 'steered for the field'), t('Rotayı koru', 'Hold course'), t('Uçağı tarlaya yönlendirdin.', 'You steered for the field.'), t('Rotayı korudun.', 'You held course.')),
    fact: fact(
      'Foot pilotu tramvay sürücüsünün yanına koyar: ikisi de birilerine zarar vermek üzeredir ve tek seçebildikleri, zararın kime düşeceğidir. Bu yüzden daha az kişiye zarar verecek yolu seçmeleri gerekir.',
      'Foot puts the pilot beside the tram driver: both are about to harm someone, and all they can choose is who. So they should take the course that harms fewer.',
    ),
  },
  {
    id: 'foot-drug',
    title: t('Doktor sensin: ilacın hepsi bir hastaya mı, beşe mi?', 'You are the doctor: the whole drug for one patient, or for five?'),
    setup: t('Elinde kıt bir ilaç var. Bir hasta ancak hepsini alırsa yaşar; beş hastanın her birine beşte biri yeter.', 'You have a scarce drug. One patient lives only if he gets all of it; a fifth would save each of five others.'),
    trackA: FIVE_PATIENTS,
    trackB: [patient(SKIN.light, 'messy', HAIR.ginger)],
    outcome: {
      pull: t('Beş hasta iyileşti; ilacın hepsine ihtiyacı olan hasta kurtulamadı.', 'The five recovered; the patient who needed all of it did not.'),
      stay: t('Bir hasta iyileşti; beş hasta kurtulamadı.', 'One patient recovered; the five did not.'),
    },
    verbs: verbs(t('Beşine paylaştır', 'Share it among five'), t('ilacı beşine paylaştırdı', 'shared it among five'), t('Hepsini birine ver', 'Give it all to one'), t('İlacı beşine paylaştırdın.', 'You shared it among the five.'), t('İlacın hepsini birine verdin.', 'You gave it all to one.')),
    fact: fact(
      'Foot’a göre burada iki yardım görevi çatışıyor: kimseye zarar vermiyorsun, yalnızca kime yardım edeceğini seçiyorsun. O zaman daha çok kişiyi kurtarmak doğrudur.',
      'For Foot, two duties of aid conflict here: you harm no one, you only choose whom to help. Then saving more people is right.',
    ),
  },
  {
    id: 'foot-crash',
    title: t('Doktor sensin: bütün koğuş tek bir hastaya mı, kazadan gelen beş yaralıya mı?', 'You are the doctor: the whole ward for one patient, or for five crash victims?'),
    setup: t(
      'Bütün ekip ağır bir hastanın başında. Ambulanslar çok araçlı bir kazadan beş yaralı getirdi; ikisine birden yetişemezsiniz.',
      'The whole team is working on one gravely ill patient. Ambulances bring in five victims of a multiple crash, and you cannot look after both.',
    ),
    trackA: strangers(5, 3),
    trackB: [patient(SKIN.medium, 'bun', HAIR.grey)],
    outcome: {
      pull: t('Kazadan gelen beş yaralı kurtuldu; koğuştaki ağır hasta kurtulamadı.', 'The five crash victims pulled through; the patient on the ward did not.'),
      stay: t('Koğuştaki hasta kurtuldu; kazadan gelen beş yaralı kurtulamadı.', 'Your patient pulled through; the five from the crash did not.'),
    },
    verbs: verbs(t('Yaralılara koş', 'Help the five'), t('yaralılara koştu', 'helped the five'), t('Hastanda kal', 'Stay with your patient'), t('Yaralılara koştun.', 'You helped the five.'), t('Hastanda kaldın.', 'You stayed with your patient.')),
    fact: fact(
      'Foot bunu kıt ilacın hemen yanına koyar: bütün bir koğuşu tek bir ağır hastaya ayıramayız, çünkü burada da yalnızca kime yardım edeceğimizi seçiyoruz. Yardım ile yardım tartılırken daha çok kişiyi kurtarmak gerekir.',
      'Foot puts this right beside the scarce drug: we cannot spare a whole ward for one dangerously ill patient, because here too we only choose whom to help. When aid is weighed against aid, we should save more.',
    ),
  },
  {
    id: 'foot-serum',
    title: t('Doktor sensin: birinin bedeninden serum yapıp beşini kurtarır mısın?', 'You are the doctor: would you make a serum from one man’s body to save five?'),
    setup: t('Beş hasta, ancak sağlıklı bir adamın bedeninden yapılacak bir serumla kurtulabilir. Bunun için onun ölmesi gerekiyor.', 'Five patients can only be saved by a serum made from a healthy man’s body, and he would have to die for it.'),
    trackA: FIVE_PATIENTS,
    trackB: [person({ top: CLOTH.teal, bottom: CLOTH.charcoal, hair: 'short', hairColor: HAIR.black, skin: SKIN.medium, marker: 'question' })],
    outcome: {
      pull: t('Beş hasta serumla iyileşti; sağlıklı adam bunun için öldü.', 'The five recovered with the serum; the healthy man died for it.'),
      stay: t('Sağlıklı adam evine döndü; beş hasta kurtulamadı.', 'The healthy man went home; the five did not recover.'),
    },
    verbs: verbs(t('Serumu yap', 'Make the serum'), t('serumu yaptı', 'made the serum'), t('Reddet', 'Refuse'), t('Serumu yaptın.', 'You made the serum.'), t('Reddettin.', 'You refused.')),
    fact: fact(
      'Foot’a göre bu, başkalarına yardım etmek için birine zarar vermek olur ve zarar vermeme görevi yardım etme görevinden daha katıdır. Organ nakli için birinden “yedek parça” almak da aynı şeydir.',
      'For Foot, this would be harming one to aid others, and the duty not to harm is stricter than the duty to help. Taking “spare parts” from someone for transplants is the same.',
    ),
  },
  {
    id: 'foot-beggar',
    title: t('Aç dilenciyi doyurur musun, yoksa bedeni beşini kurtarsın diye ölmesine mi izin verirsin?', 'Do you feed the starving beggar, or let him die so his body can save five?'),
    setup: t(
      'Beş hasta ancak bir bedenden yapılacak serumla kurtulabilir. Kapıda açlıktan ölmek üzere olan bir dilenci yemek istiyor.',
      'Five patients can be saved only by a serum made from a body. At the door, a beggar close to starving asks for food.',
    ),
    trackA: FIVE_PATIENTS,
    trackB: [person({ top: CLOTH.brown, bottom: '#5d5246', shoes: '#3b342c', hair: 'messy', hairColor: HAIR.grey, skin: SKIN.light, accessories: ['beard'] })],
    outcome: {
      pull: t('Dilenci açlıktan öldü; bedeninden yapılan serum beş hastayı kurtardı.', 'The beggar starved; the serum made from his body saved the five.'),
      stay: t('Dilenci karnını doyurup yoluna gitti; beş hasta kurtulamadı.', 'The beggar ate and went on his way; the five were not saved.'),
    },
    verbs: verbs(t('Geri çevir', 'Turn him away'), t('dilenciyi geri çevirdi', 'turned the beggar away'), t('Yemek ver', 'Feed him'), t('Dilenciyi geri çevirdin.', 'You turned him away.'), t('Dilenciye yemek verdin.', 'You fed him.')),
    fact: fact(
      'Foot bunu serum vakasının ilginç bir çeşidi olarak anar: onu öldürmüyorsun, yalnızca ölmesine izin veriyorsun. Ama ölümünü bedeni için istediğinden bu, yardım etmemek değil, zarar vermek sayılır.',
      'Foot calls this an interesting variant of the serum: you do not kill him, you only let him die. But since you want his death for his body, it counts as harming him, not merely failing to help.',
    ),
  },
  {
    id: 'foot-gas',
    title: t('Doktor sensin: beşini kurtaracak gaz, yan odadaki hastayı zehirleyecek', 'You are the doctor: the gas that saves five will poison the patient next door'),
    setup: t('Beş hasta, ancak üretilecek bir gazla kurtulabilir. Gazın dumanı, yerinden kıpırdatılamayan başka bir hastanın odasına dolacak.', 'Five patients can be saved only by making a gas. Its fumes would fill the room of another patient who cannot be moved.'),
    trackA: FIVE_PATIENTS,
    trackB: [patient(SKIN.fair, 'short', HAIR.white)],
    outcome: {
      pull: t('Gaz beş hastayı kurtardı; dumanı yan odadaki hastayı öldürdü.', 'The gas saved the five; its fumes killed the patient next door.'),
      stay: t('Yan odadaki hasta yaşadı; beş hasta kurtulamadı.', 'The patient next door lived; the five did not.'),
    },
    verbs: verbs(t('Gazı üret', 'Make the gas'), t('gazı üretti', 'made the gas'), t('Üretme', 'Don’t make it'), t('Gazı ürettin.', 'You made the gas.'), t('Gazı üretmedin.', 'You didn’t make the gas.')),
    fact: fact(
      'Ölüm burada amaçlanmıyor, yalnızca öngörülüyor; yine de Foot gazın üretilmemesi gerektiğini söyler. Ona göre fark niyette değil: birine zarar vermek, başkalarına yardım etmekten daha ağır basar.',
      'His death would not be intended, only foreseen; still, Foot says the gas should not be made. For her the difference is not intention: harming one outweighs helping others.',
    ),
  },
  {
    id: 'foot-rescue',
    title: t('Yalnızca bir kapıyı açabilirsin: beşini mi kurtarırsın, birini mi?', 'You can open only one door: rescue five, or one?'),
    setup: t('Tiranın işkencecileri beş kişiyi bir hücrede, bir kişiyi öbüründe tutuyor. Anahtar yalnızca bir kapıya yetecek.', 'The tyrant’s torturers hold five people in one cell and one in the other. The key will open only one door.'),
    trackA: FIVE_PRISONERS,
    trackB: [prisoner(SKIN.light, 'bun', HAIR.chestnut)],
    outcome: {
      pull: t('Beş kişi kurtuldu; öbür hücredeki kişi orada kaldı.', 'The five are free; the one in the other cell is left behind.'),
      stay: t('Bir kişi kurtuldu; beş kişi hücrede kaldı.', 'The one is free; the five are left behind.'),
    },
    verbs: verbs(t('Beşini kurtar', 'Rescue the five'), t('beşini kurtardı', 'rescued the five'), t('Birini kurtar', 'Rescue the one'), t('Beşini kurtardın.', 'You rescued the five.'), t('Birini kurtardın.', 'You rescued the one.')),
    fact: fact(
      'Burada zarar veren sen değilsin; iki yardım görevinden birini seçiyorsun. Foot’a göre yardım ederken daha büyük grubu kurtarmak gerekir.',
      'You harm no one here; you choose between two duties of aid. For Foot, when bringing aid you should save the larger group.',
    ),
  },
  {
    id: 'foot-tyrant',
    title: t('Tiran, sen birine işkence etmezsen beşine edecek', 'The tyrant will torture five unless you torture one'),
    setup: t('Tiran zindanda bekliyor. Kolu sen çekip birine acı vermezsen, o beş kişiye verecek.', 'The tyrant waits in his dungeon. Unless you pull the lever and hurt one prisoner, he will hurt five.'),
    trackA: FIVE_PRISONERS,
    trackB: [prisoner(SKIN.medium, 'long', HAIR.brown)],
    outcome: {
      pull: t('Beş kişi kurtuldu; ama bir kişiye acı veren sendin.', 'The five were spared, but you were the one who hurt someone.'),
      stay: t('Ellerin temiz kaldı; tiran beş kişiye işkence etti.', 'Your hands stayed clean; the tyrant tortured five.'),
    },
    verbs: verbs(t('Dediğini yap', 'Do as he says'), t('tiranın dediğini yaptı', 'did as the tyrant said'), t('Reddet', 'Refuse'), t('Tiranın dediğini yaptın.', 'You did as he said.'), t('Reddettin.', 'You refused.')),
    fact: fact(
      'Foot’a göre birine zarar vermemek, başkalarının vereceği zararı önlemekten daha katı bir görevdir. Tiranın beş kişiye yaptığı onun kötülüğüdür; senin elinle yapılan değil.',
      'For Foot, not harming someone is a stricter duty than preventing the harm others will do. What the tyrant does to the five is his cruelty, not done by your hand.',
    ),
  },
  {
    id: 'foot-madman',
    title: t('Katil, sen masum birini öldürmezsen ikisini öldürecek', 'The killer will kill two unless you kill an innocent'),
    setup: t('Sözünü hep tutan bir katil iki rehine tutuyor. Kolu çekip masum birini öldürmezsen, ikisini öldürecek.', 'A killer who always keeps his word holds two hostages. Unless you pull the lever on an innocent man, he will kill both.'),
    trackA: strangers(2, 5).map((stranger) => ({ ...stranger, marker: 'exclaim' as const })),
    trackB: [person({ top: CLOTH.yellow, bottom: CLOTH.navy, hair: 'spiky', hairColor: HAIR.blonde, skin: SKIN.fair, marker: 'question' })],
    outcome: {
      pull: t('İki rehine kurtuldu; masum adamı sen öldürdün.', 'The two hostages were spared; you killed the innocent man.'),
      stay: t('Katilin dediğini yapmadın; o da iki rehineyi öldürdü.', 'You would not do the killer’s bidding; he killed the two hostages.'),
    },
    verbs: verbs(t('Dediğini yap', 'Do as he says'), t('katilin dediğini yaptı', 'did as the killer said'), t('Reddet', 'Refuse'), t('Katilin dediğini yaptın.', 'You did as he said.'), t('Reddettin.', 'You refused.')),
    fact: fact(
      'Foot burada da reddetmekten yanadır: kötü insanların tehditleri bizi masum birine zarar vermeye zorlayamaz. Olacak cinayetler katilin olur, senin değil.',
      'Here too Foot sides with refusing: wicked men’s threats cannot oblige us to harm an innocent. The murders that follow are the killer’s, not yours.',
    ),
  },
  {
    id: 'foot-children',
    title: t('Çocukların açlıktan ölüyor: yiyecek için birini öldürür müsün?', 'Your children are starving: would you kill a man for food?'),
    setup: t('Evde üç çocuğun açlıktan ölmek üzere. Yiyeceği ancak onu taşıyan adamı öldürerek alabilirsin.', 'At home your three children are starving to death. The only way to get food is to kill the man carrying it.'),
    trackA: [child(CLOTH.yellow, 'messy', 0.7), child(CLOTH.pink, 'bun', 0.66), child(CLOTH.teal, 'short', 0.62)],
    trackB: [person({ top: CLOTH.cream, bottom: CLOTH.brown, hair: 'short', hairColor: HAIR.black, skin: SKIN.medium, accessories: ['mustache'] })],
    outcome: {
      pull: t('Çocukların karnı doydu; yiyeceği taşıyan adam öldü.', 'Your children ate; the man carrying the food is dead.'),
      stay: t('Kimseye dokunmadın; çocukların açlıktan kurtulamadı.', 'You harmed no one; your children did not survive the hunger.'),
    },
    verbs: verbs(t('Öldür', 'Kill him'), t('yiyecek için öldürdü', 'killed for the food'), t('Vazgeç', 'Hold back'), t('Yiyecek için öldürdün.', 'You killed for the food.'), t('Vazgeçtin.', 'You held back.')),
    fact: fact(
      'Foot’a göre kendi çocuklarını doyurmak, yardım görevlerinin en katısıdır; yine de bir zarar vermeme görevi gibi ağır basmaz. Aç çocuklarına yiyecek götürmek için cinayet işlemek caiz değildir.',
      'For Foot, feeding your own children is the strictest duty of aid there is; still, it does not weigh like a duty not to harm. It is not permissible to commit a murder to bring your starving children food.',
    ),
  },
  {
    id: 'foot-oil',
    title: t('Tüccar sensin: zehirli olduğunu bildiğin yağı satar mısın?', 'You are the merchant: do you sell oil you know is poisonous?'),
    setup: t(
      'Deponda zehirli olduğunu bildiğin yemeklik yağ var. Satarsan dükkânın ayakta kalır; dökersen batarsın. Kimsenin ölmesini istemiyorsun, ama öleceklerini biliyorsun.',
      'Your storeroom is full of cooking oil you know is poisonous. Sell it and your shop survives; pour it away and you are ruined. You don’t want anyone to die, but you know they will.',
    ),
    trackA: [],
    trackB: strangers(5, 1),
    outcome: {
      pull: t('Dükkânın kurtuldu; yemeğini o yağla pişiren beş müşterin öldü.', 'The shop is saved; five customers who cooked with it died.'),
      stay: t('Dükkânın battı, ama kimse ölmedi.', 'The shop went under, but nobody died.'),
    },
    verbs: verbs(t('Sat', 'Sell it'), t('yağı sattı', 'sold the oil'), t('Dök', 'Pour it away'), t('Yağı sattın.', 'You sold the oil.'), t('Yağı döktün.', 'You poured it away.')),
    fact: fact(
      'Foot’a göre bu tüccarlar katildir: ölümleri amaçlamasalar da öngörürler ve bu bir mazeret değildir. Aynı yağı mezar siparişi için satan mezarcılardan ahlaken farkları yoktur; geçim derdi, masumların ölümünü ne amaçlamayı ne de öngörmeyi haklı çıkarır.',
      'For Foot such merchants are murderers: they foresee the deaths without aiming at them, and that is no excuse. They are no better than gravediggers who sell the same oil to drum up burials; earning a living justifies neither aiming at nor foreseeing innocent deaths.',
    ),
  },
  {
    id: 'foot-education',
    title: t('Bakan sensin: istatistikler intiharların artacağını öngörse de eğitim seviyesini yükseltir misin?', 'You are the minister: do you raise the level of education, though statistics predict more suicides?'),
    setup: t(
      'Yeni bir reform milyonlarca gence daha iyi bir eğitim verecek. İstatistikler, ardından intihar oranının biraz artacağını öngörüyor.',
      'A new reform will give millions of young people a better education. Statistics predict a small rise in the suicide rate to follow.',
    ),
    trackA: [],
    trackB: [person({ top: CLOTH.grey, bottom: CLOTH.charcoal, hair: 'short', hairColor: HAIR.black, skin: SKIN.medium, marker: 'question' })],
    outcome: {
      pull: t('Okullar doldu, milyonlarca genç daha iyi bir eğitim aldı; istatistikler de öngörülen küçük artışı gösterdi.', 'The schools filled and millions got a better education; the statistics showed the small rise that was foreseen.'),
      stay: t('Ne istatistikler değişti, ne de eğitim.', 'Neither the statistics changed, nor education.'),
    },
    verbs: verbs(t('Reformu yap', 'Pass the reform'), t('reformu yaptı', 'passed the reform'), t('Rafa kaldır', 'Shelve it'), t('Reformu yaptın.', 'You passed the reform.'), t('Reformu rafa kaldırdın.', 'You shelved the reform.')),
    fact: fact(
      'Makale bu örnekle açılır: istatistikler intiharların artacağını öngörse de eğitim seviyesini yükseltmeyi doğru buluruz, kanser araştırması için insan öldürmeyi ise asla. Foot’a göre sezgilerimiz net, ama dayandıkları ilke belli değil.',
      'The essay opens with this: we think it right to raise the level of education though statistics predict more suicides, but never to kill people for cancer research. Our intuitions are clear, Foot says; the principle behind them is not.',
    ),
  },
  {
    id: 'foot-cave',
    title: t('Başı dışarıda sıkışan iri adamı dinamitle patlatır mısın?', 'Would you blast out the stuck man whose head is outside the cave?'),
    setup: t(
      'İri bir adam mağaranın tek çıkışına sıkıştı; başı dışarıda. Su yükseliyor: beklerseniz o kurtarılacak, ama siz boğulacaksınız.',
      'A large man is stuck in the cave’s only way out, his head outside. The water is rising: if you wait, he will be rescued, but you will all drown.',
    ),
    trackA: FIVE_CAVERS,
    trackB: [STUCK],
    outcome: {
      pull: t('Çıkış açıldı, ötekiler kurtuldu; sıkışan adam kurtulamadı.', 'The way out is open and the party escapes; the stuck man does not.'),
      stay: t('Sıkışan adama dokunmadınız; su yükseldi ve içeridekiler boğuldu. O sonra kurtarıldı.', 'You left the stuck man alone; the water rose and those inside drowned. He was rescued later.'),
    },
    verbs: verbs(t('Dinamiti patlat', 'Blast him out'), t('dinamiti patlattı', 'blasted him out'), t('Bekle', 'Wait'), t('Dinamiti patlattın.', 'You blasted him out.'), t('Beklediniz.', 'You waited.')),
    fact: fact(
      'Foot mağarayı iki hâliyle anlatır. Başı dışarıdaysa beklemek onu kurtarır, sizi öldürür; bu hâl için bir hüküm vermez, yalnızca tehdidi oluşturanın onun varlığı olmasının fark yaratabileceğini söyler.',
      'Foot tells the cave in two versions. With his head outside, waiting saves him and kills the rest; for this one she gives no verdict, only noting that it may matter that his very presence is the threat.',
    ),
  },
  {
    id: 'foot-cave-inside',
    title: t('Başı içeride sıkışan iri adamı dinamitle patlatır mısın?', 'Would you blast out the stuck man whose head is inside the cave?'),
    setup: t(
      'İri bir adam mağaranın tek çıkışına sıkıştı; başı içeride. Su yükseliyor: beklerseniz o da sizinle birlikte boğulacak.',
      'A large man is stuck in the cave’s only way out, his head inside. The water is rising: if you wait, he will drown along with you.',
    ),
    // Waiting drowns everyone, the stuck man too.
    trackA: [...FIVE_CAVERS, STUCK],
    trackB: [STUCK],
    outcome: {
      pull: t('Çıkış açıldı, ötekiler kurtuldu; sıkışan adam kurtulamadı.', 'The way out is open and the party escapes; the stuck man does not.'),
      stay: t('Su yükseldi ve sıkışan adam da dahil herkes boğuldu.', 'The water rose and everyone drowned, the stuck man too.'),
    },
    verbs: verbs(t('Dinamiti patlat', 'Blast him out'), t('dinamiti patlattı', 'blasted him out'), t('Bekle', 'Wait'), t('Dinamiti patlattın.', 'You blasted him out.'), t('Beklediniz.', 'You waited.')),
    fact: fact(
      'Foot makalenin sonunda bu hâle döner: adam her durumda öleceği için gerçek bir çıkar çatışması yoktur ve birilerini kurtaracak olanı yapmak makuldür. Bunu, anneyle bebeğin ikisinin de öleceği bir doğumun paraleli olarak kurar.',
      'Foot returns to this version at the end: since he will die either way, there is no real conflict of interests, and it is reasonable to do what saves someone. It is her parallel for a birth in which mother and child would both die.',
    ),
  },
  {
    id: 'foot-lifeboat',
    title: t('Filika batıyor: birini denize atar mısınız?', 'The lifeboat is sinking: do you throw someone overboard?'),
    setup: t(
      'Fırtınada aşırı yüklü bir filikadasınız. Birini denize atmazsanız filika batacak ve hepiniz boğulacaksınız.',
      'You are in an overloaded lifeboat in a storm. Unless someone is thrown overboard, the boat will founder and you will all drown.',
    ),
    // Waiting drowns everyone aboard, the one they would throw over too.
    trackA: [
      castaway(CLOTH.mint, SKIN.light, 'messy', HAIR.black),
      castaway(CLOTH.red, SKIN.fair, 'short', HAIR.ginger),
      castaway(CLOTH.white, SKIN.deep, 'bald', HAIR.black),
      castaway(CLOTH.blue, SKIN.tan, 'long', HAIR.chestnut),
      castaway(CLOTH.orange, SKIN.light, 'short', HAIR.grey),
      OVERBOARD,
    ],
    trackB: [OVERBOARD],
    outcome: {
      pull: t('Filika fırtınayı atlattı; denize atılan adam kurtulamadı.', 'The boat rode out the storm; the man thrown overboard did not survive.'),
      stay: t('Kimseye dokunmadınız; filika battı ve hepiniz boğuldunuz.', 'You laid hands on no one; the boat went down and you all drowned.'),
    },
    verbs: verbs(t('Denize at', 'Throw one overboard'), t('birini denize attı', 'threw someone overboard'), t('Bekle', 'Wait'), t('Birini denize attınız.', 'You threw one overboard.'), t('Beklediniz.', 'You waited.')),
    fact: fact(
      'Foot bu ünlü denizci vakasını, sandalda miçoyu öldürüp yiyen Dudley ile Stephens’la birlikte anar: kimse kurtulamayacaksa birini kurtarmak, hiç kimseyi kurtarmamaktan iyidir. Yine de bu korkunç işten geri durana saygı duyulacağını ekler.',
      'Foot sets this famous case of shipwrecked mariners beside Dudley and Stephens, who killed and ate their cabin boy while adrift: if no one would be saved otherwise, saving some beats saving none. Still, one would respect someone who held back.',
    ),
  },
  // The operations of the abortion debate: nobody is counted, the scene draws its own patient.
  {
    id: 'foot-hysterectomy',
    title: t('Cerrah sensin: hamile hastanın kanserli rahmini alır mısın?', 'You are the surgeon: do you remove a pregnant patient’s cancerous womb?'),
    setup: t(
      'Hamile bir hastanın rahminde kanser var. Rahim alınırsa hasta yaşayacak ama cenin ölecek; ameliyat edilmezse ikisi de ölecek.',
      'A pregnant patient has cancer of the womb. Removing it will save her, but the foetus will die; without the operation, both will die.',
    ),
    trackA: [],
    trackB: [],
    uncounted: true,
    outcome: {
      pull: t('Hasta kurtuldu; cenin yaşamadı.', 'The patient survived; the foetus did not.'),
      stay: t('Ameliyat yapılmadı; ikisi de yaşamadı.', 'There was no operation; neither survived.'),
    },
    verbs: verbs(t('Ameliyat et', 'Operate'), t('ameliyat etti', 'operated'), t('Bekle', 'Wait'), t('Ameliyat ettin.', 'You operated.'), t('Beklemeyi seçtin.', 'You chose to wait.')),
    fact: fact(
      'Çifte etki öğretisi bu ameliyata izin verir: ceninin ölümü amaçlanmaz, yalnızca öngörülür. Foot sonuca katılır ama gerekçeye katılmaz: ikisi de öleceğine göre kurtarılabilecek olanı kurtarmak makuldür; ölümün nasıl gerçekleştiği bir şey değiştirmez.',
      'The doctrine of double effect allows this operation: the foetus’s death is not aimed at, only foreseen. Foot accepts the conclusion but not the reason: since both would die, it is reasonable to save the one who can be saved; how the death comes about makes no difference.',
    ),
  },
  {
    id: 'foot-craniotomy',
    title: t('Doğum tıkandı ve ikisi de ölecek: anneyi kurtaracak ameliyatı yapar mısın?', 'The labour is obstructed and both will die: do you perform the operation that saves the mother?'),
    setup: t(
      'Doğum ilerlemiyor. Bebeğin ölümüne yol açan bir ameliyat (kraniyotomi) anneyi kurtarabilir; yapılmazsa anne de bebek de ölecek.',
      'The labour cannot progress. An operation that ends the baby’s life (a craniotomy) can save the mother; without it, mother and baby will both die.',
    ),
    trackA: [],
    trackB: [],
    uncounted: true,
    outcome: {
      pull: t('Anne kurtuldu; bebek yaşamadı.', 'The mother survived; the baby did not.'),
      stay: t('Ameliyat yapılmadı; ikisi de yaşamadı.', 'There was no operation; neither survived.'),
    },
    verbs: verbs(t('Ameliyat et', 'Operate'), t('ameliyat etti', 'operated'), t('Bekle', 'Wait'), t('Ameliyat ettin.', 'You operated.'), t('Beklemeyi seçtin.', 'You chose to wait.')),
    fact: fact(
      'Çifte etki öğretisi bu ameliyatı yasaklar, çünkü bebeğin ölümü doğrudan amaçlanmış olur; anneyi kurtarmak için bile müdahale edilmemesini ister. Foot’a göre bu görüş burada çoğu makul insanınkiyle çatışır: bebek her durumda öleceğinden, birini kurtaracak ameliyat yapılabilir, yöntemi ne olursa olsun.',
      'The doctrine of double effect forbids this operation, since the baby’s death would be directly intended, and asks that nothing be done even to save the mother. Here, Foot says, that view conflicts with most reasonable people’s: since the baby will die either way, the operation that saves someone may be done, whatever its method.',
    ),
  },
  {
    id: 'foot-mother-or-child',
    title: t('Ya anne ya bebek: hangisini kurtarırsın?', 'Mother or baby: whom do you save?'),
    setup: t('Bir ameliyat anneyi ya da bebeği kurtarabilir, ikisini birden değil. Hiçbir şey yapılmazsa ikisi de ölecek.', 'An operation can save the mother or the baby, not both. If nothing is done, both will die.'),
    trackA: [],
    trackB: [],
    uncounted: true,
    outcome: {
      pull: t('Anne kurtuldu; bebek yaşamadı.', 'The mother survived; the baby did not.'),
      stay: t('Bebek sağ doğdu; anne yaşamadı.', 'The baby was born alive; the mother did not survive.'),
    },
    verbs: verbs(t('Anneyi kurtar', 'Save the mother'), t('anneyi kurtardı', 'saved the mother'), t('Bebeği kurtar', 'Save the baby'), t('Anneyi kurtardın.', 'You saved the mother.'), t('Bebeği kurtardın.', 'You saved the baby.')),
    fact: fact(
      'Foot bunu batan filikadaki denizcilerle birlikte anar: harekete geçmek konusunda bir çatışma yoktur, yalnızca kimin kurtarılacağı seçilir. Muhtemelen anneden yana karar verileceğini söyler; ama çocuk doğup birkaç yaşına geldiğinde kararın kolayca öbür yöne dönebileceğini de ekler.',
      'Foot sets this beside the shipwrecked mariners: there is no conflict over whether to act, only over whom to save. Probably, she says, we would decide for the mother; but she adds that a few years later, with the child born, we might easily decide the other way.',
    ),
  },
  {
    id: 'foot-worst-dilemma',
    title: t('En zor ikilem: bebek ameliyatsız da yaşayabilecekken anneyi kurtarmak için ameliyat eder misin?', 'The worst dilemma: do you operate to save the mother, when the baby could live without it?'),
    setup: t(
      'Anneyi kurtarmanın tek yolu bebeğin ölümüne yol açan bir ameliyat. Ameliyat edilmezse anne ölecek, ama bebek ondan sonra sağ salim doğurtulabilecek.',
      'The only way to save the mother is an operation that ends the baby’s life. Without it the mother will die, but the baby can be safely delivered after her death.',
    ),
    trackA: [],
    trackB: [],
    uncounted: true,
    outcome: {
      pull: t('Anne kurtuldu; bebek yaşamadı.', 'The mother survived; the baby did not.'),
      stay: t('Anne yaşamadı; bebek sağ salim doğdu.', 'The mother did not survive; the baby was safely delivered.'),
    },
    verbs: verbs(t('Ameliyat et', 'Operate'), t('ameliyat etti', 'operated'), t('Ameliyat etme', 'Don’t operate'), t('Ameliyat ettin.', 'You operated.'), t('Ameliyat etmedin.', 'You did not operate.')),
    fact: fact(
      'Foot’a göre en zor ikilem bu. Çifte etki öğretisi müdahaleyi yasaklar; doğmuş çocuklarla kurulan katı bir paralel de aynı sonuca varabilir, çünkü bir masumu başka birini kurtarmak için öldürmeyiz. Ama doğmamış çocuğa olağan insan statüsü tanımayanlar bunu böyle görmez; Foot bu görüşlerden hiçbirini savunmadığını söyler.',
      'For Foot this is the worst dilemma. The doctrine of double effect forbids intervening, and a strict parallel with children already born might reach the same conclusion, since we do not kill one innocent to rescue another. But many do not accord the unborn ordinary human status; Foot says she argues for none of these views.',
    ),
  },
]

/** What Foot herself would do in each case; null where she leaves it open. */
export const FOOT_ANSWERS: Readonly<Record<FootDilemmaId, TrolleyChoice | null>> = {
  'foot-driver': 'pull',
  'foot-judge': 'stay',
  'foot-pilot': 'pull',
  'foot-drug': 'pull',
  'foot-crash': 'pull',
  'foot-serum': 'stay',
  'foot-beggar': 'stay',
  'foot-gas': 'stay',
  'foot-rescue': 'pull',
  'foot-tyrant': 'stay',
  'foot-madman': 'stay',
  'foot-children': 'stay',
  'foot-oil': 'stay',
  'foot-education': 'pull',
  'foot-cave': null,
  'foot-cave-inside': 'pull',
  'foot-lifeboat': 'pull',
  'foot-hysterectomy': 'pull',
  'foot-craniotomy': 'pull',
  'foot-mother-or-child': 'pull',
  'foot-worst-dilemma': null,
}

export type FootPrincipleId = 'harms' | 'aid' | 'harm-for-aid' | 'foreseen' | 'no-one-spared' | 'abortion' | 'open'

/** Which duties clash in a group of Foot's cases, and the rule she draws for them. */
export interface FootPrinciple {
  readonly id: FootPrincipleId
  readonly title: Localized
  /** Her rule for the group, in a line. */
  readonly rule: Localized
  readonly cases: readonly FootDilemmaId[]
}

/** Every playable case, in exactly one group: the shape of Foot's answer. */
export const FOOT_PRINCIPLES: readonly FootPrinciple[] = [
  {
    id: 'harms',
    title: t('Zarar mı, zarar mı?', 'Harm or harm?'),
    rule: t('İki yolda da zarar veriyorsun: en az zararı seç.', 'Either way you do harm: do the least.'),
    cases: ['foot-driver', 'foot-pilot'],
  },
  {
    id: 'aid',
    title: t('Yardım mı, yardım mı?', 'Aid or aid?'),
    rule: t('Kimseye zarar vermiyorsun: daha çok kişiye yardım et.', 'You harm no one: help the larger number.'),
    cases: ['foot-drug', 'foot-crash', 'foot-rescue'],
  },
  {
    id: 'harm-for-aid',
    title: t('Yardım için zarar', 'Harm for the sake of aid'),
    rule: t('Zarar vermemek, yardım etmekten daha katı bir görev: reddet.', 'Not harming is a stricter duty than helping: refuse.'),
    cases: ['foot-judge', 'foot-serum', 'foot-beggar', 'foot-gas', 'foot-tyrant', 'foot-madman', 'foot-children'],
  },
  {
    id: 'foreseen',
    title: t('Öngörülen ölümler', 'Foreseen deaths'),
    rule: t('Öngörmek mazeret değil; ama bazı amaçlar öngörülen kayıpları haklı çıkarır.', 'Foreseeing is no excuse, though some ends justify foreseen losses.'),
    cases: ['foot-oil', 'foot-education'],
  },
  {
    id: 'no-one-spared',
    title: t('Kimse kurtulamayacaksa', 'When no one would be spared'),
    rule: t('Beklemek kimseyi kurtarmıyorsa, birilerini kurtaracak olanı yap.', 'If waiting saves no one, do what saves someone.'),
    cases: ['foot-cave-inside', 'foot-lifeboat'],
  },
  {
    id: 'abortion',
    title: t('Kürtaj tartışması', 'The abortion debate'),
    rule: t(
      'Paralellerle düşünür: ikisi de ölecekse kurtarılabilecek olanı kurtarmak makul; en zor durumda taraf tutmaz.',
      'She reasons by parallels: if both would die, saving who can be saved is reasonable; in the worst case she takes no side.',
    ),
    cases: ['foot-hysterectomy', 'foot-craniotomy', 'foot-mother-or-child', 'foot-worst-dilemma'],
  },
  {
    id: 'open',
    title: t('Açık bıraktığı', 'Left open'),
    rule: t('Burada bir hüküm vermez.', 'Here she gives no verdict.'),
    cases: ['foot-cave'],
  },
]

/** Foot's cases as one chapter, so they play, list and compare like the absurd ones. */
export const FOOT_CHAPTER: AnyChapter = { id: 'foot', title: t('Philippa Foot, 1967', 'Philippa Foot, 1967'), dilemmas: FOOT_DILEMMAS }

/** The cases in the essay that are not choices anyone in them makes. */
export const OTHER_FOOT_CASES = FOOT_CASES.filter((footCase) => !footCase.play)

/** The essay's short name for a playable case (“The runaway tram”), for lists too narrow for the question. */
export function footCaseTitle(id: FootDilemmaId): Localized | null {
  return FOOT_CASES.find((footCase) => footCase.play === id)?.title ?? null
}
