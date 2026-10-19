import { CLOTH, COATS, HAIR, INFLUENCERS, SKIN, YOU, cat, person, prop, strangers } from './cast'
import type { Actor, Chapter, Dilemma, ResearchFact, TrolleyDilemmaId } from './types'

/**
 * Two chapters of twelve. Track A is where the tram goes if nobody touches
 * anything; track B is where the lever sends it. The research notes cite
 * the studies they come from; everything else is original nonsense.
 */

const AWAD_2020 = { source: 'Awad et al., PNAS (2020)', url: 'https://www.pnas.org/doi/10.1073/pnas.1911517117' } as const
const AWAD_2018 = { source: 'Awad et al., Nature (2018)', url: 'https://www.nature.com/articles/s41586-018-0637-6' } as const
const BONNEFON_2016 = { source: 'Bonnefon, Shariff & Rahwan, Science (2016)', url: 'https://www.science.org/doi/10.1126/science.aaf2654' } as const

const fact = (cite: { readonly source: string; readonly url: string }, tr: string, en: string): ResearchFact => ({ text: { tr, en }, ...cite })

const FRIDAY_YOU = person({ top: CLOTH.mint, bottom: CLOTH.navy, hair: 'messy', hairColor: HAIR.black, accessories: ['partyhat'], pose: 'cheer', marker: 'music' })
const MONDAY_YOU = person({ top: CLOTH.mint, bottom: CLOTH.grey, hair: 'messy', hairColor: HAIR.black, accessories: ['mug'], pose: 'hold', marker: 'zzz' })

const QUIET_PASSENGERS: readonly Actor[] = [
  person({ top: CLOTH.blue, bottom: CLOTH.charcoal, accessories: ['headphones'], hairColor: HAIR.brown }),
  person({ top: CLOTH.purple, bottom: CLOTH.denim, hair: 'long', hairColor: HAIR.black, accessories: ['book'], skin: SKIN.medium }),
  person({ top: CLOTH.grey, bottom: CLOTH.black, hair: 'short', hairColor: HAIR.grey, accessories: ['glasses', 'book'], skin: SKIN.fair }),
  person({ top: CLOTH.teal, bottom: CLOTH.khaki, hair: 'bun', hairColor: HAIR.chestnut, accessories: ['headphones'], skin: SKIN.tan }),
  person({ top: CLOTH.red, bottom: CLOTH.navy, hair: 'spiky', hairColor: HAIR.black, accessories: ['headphones'], skin: SKIN.deep }),
]

const SPEAKER_FAN = person({ top: CLOTH.yellow, bottom: CLOTH.black, hair: 'spiky', hairColor: HAIR.ginger, accessories: ['boombox', 'sunglasses'], pose: 'shoulder', marker: 'music' })

const YOUNG_GRANDPA = person({ top: CLOTH.cream, bottom: CLOTH.brown, hair: 'short', hairColor: HAIR.brown, accessories: ['fedora', 'mustache', 'tie'], marker: 'question' })

const BILLIONAIRE = person({ top: CLOTH.black, bottom: CLOTH.black, hair: 'short', hairColor: HAIR.grey, accessories: ['tophat', 'mustache', 'tie', 'moneybag', 'moneypile'], marker: 'dollar', skin: SKIN.fair })

const COWORKER = person({ top: CLOTH.white, bottom: CLOTH.charcoal, hair: 'short', hairColor: HAIR.black, accessories: ['tie', 'mug', 'glasses'], pose: 'hold', skin: SKIN.medium })

const BIG_MAN = person({ top: CLOTH.orange, bottom: CLOTH.denim, hair: 'short', hairColor: HAIR.brown, accessories: ['beard'], scale: 1.22 })

const GIANT_DUCK: Actor = { kind: 'duck', coat: '#f4f1ea', accent: '#f2a03d', scale: 3.2 }
const TINY_HORSES: readonly Actor[] = [
  { kind: 'horse', coat: '#8b5a3a', accent: '#2a1d18' },
  { kind: 'horse', coat: '#efe7da', accent: '#9a8b78' },
  { kind: 'horse', coat: '#2c2a30', accent: '#111014' },
  { kind: 'horse', coat: '#b8733e', accent: '#f1e6d2' },
  { kind: 'horse', coat: '#9aa2ad', accent: '#4a4f58' },
]

const SEEN_FRIENDS: readonly Actor[] = [
  person({ top: CLOTH.orange, bottom: CLOTH.denim, accessories: ['phone'], pose: 'phone', marker: 'seen', hairColor: HAIR.black, skin: SKIN.medium }),
  person({ top: CLOTH.teal, bottom: CLOTH.black, hair: 'long', hairColor: HAIR.blonde, accessories: ['phone'], pose: 'phone', marker: 'seen', skin: SKIN.fair }),
  person({ top: CLOTH.red, bottom: CLOTH.khaki, hair: 'messy', hairColor: HAIR.brown, accessories: ['phone', 'glasses'], pose: 'phone', marker: 'seen' }),
  person({ top: CLOTH.purple, bottom: CLOTH.jeans, hair: 'bun', hairColor: HAIR.black, accessories: ['phone'], pose: 'phone', marker: 'seen', skin: SKIN.deep }),
  person({ top: CLOTH.yellow, bottom: CLOTH.charcoal, hair: 'spiky', hairColor: HAIR.ginger, accessories: ['phone', 'cap'], pose: 'phone', marker: 'seen', hatColor: '#2f5fbf' }),
]

const ALIEN = person({ top: CLOTH.purple, bottom: CLOTH.purple, shoes: '#2a2b33', skin: '#86d96b', hair: 'bald', accessories: ['antenna'], alien: true, marker: 'question' })

const BEST_FRIEND = person({ top: CLOTH.pink, bottom: CLOTH.navy, hair: 'long', hairColor: HAIR.chestnut, marker: 'love', pose: 'cheer' })

const CLONES: readonly Actor[] = Array.from({ length: 5 }, () => ({ ...YOU, marker: 'question' as const }))

const ELDERS: readonly Actor[] = [
  person({ top: CLOTH.cream, bottom: CLOTH.brown, hair: 'short', hairColor: HAIR.white, accessories: ['cane', 'glasses'], skin: SKIN.light }),
  person({ top: CLOTH.purple, bottom: CLOTH.grey, hair: 'bun', hairColor: HAIR.grey, accessories: ['cane'], skin: SKIN.medium }),
  person({ top: CLOTH.green, bottom: CLOTH.khaki, hair: 'bald', hairColor: HAIR.grey, accessories: ['glasses', 'mustache', 'cane'], skin: SKIN.tan }),
  person({ top: CLOTH.red, bottom: CLOTH.charcoal, hair: 'long', hairColor: HAIR.white, accessories: ['cane'], skin: SKIN.fair }),
  person({ top: CLOTH.blue, bottom: CLOTH.grey, hair: 'short', hairColor: HAIR.grey, accessories: ['cane', 'beard'], skin: SKIN.deep }),
]

const YOUNG = person({ top: CLOTH.mint, bottom: CLOTH.jeans, hair: 'spiky', hairColor: HAIR.black, accessories: ['backpack', 'headphones'], pose: 'phone', skin: SKIN.medium })

/** Shown for the finale when nobody has been saved yet (a fresh start on chapter 2). */
export const DEFAULT_SURVIVORS: readonly Actor[] = [...strangers(4, 1), cat(COATS.orange), { kind: 'dog', coat: '#d9a055', accent: '#f2e2c4' }]

export const DILEMMAS: readonly Dilemma[] = [
  {
    id: 'influencers-vs-last-cat',
    title: { tr: '5 influencer mı, son kedi mi?', en: '5 influencers or the last cat?' },
    setup: { tr: 'Kontrolden çıkan tramvay yaklaşıyor. Karar senin.', en: 'A runaway tram is coming. Your call.' },
    trackA: INFLUENCERS,
    trackB: [cat(COATS.orange, '#f7f1e6', 'exclaim')],
    outcome: {
      pull: { tr: 'İnternet artık sadece köpek videolarından ibaret.', en: 'The internet is now nothing but dog videos.' },
      stay: { tr: 'Takipçileri hâlâ yayının geri gelmesini bekliyor.', en: 'Their followers are still waiting for the stream to come back.' },
    },
    fact: fact(
      AWAD_2018,
      'MIT’nin Moral Machine deneyinde (233 ülke ve bölge, yaklaşık 40 milyon karar) en güçlü eğilimlerden biri insanları hayvanlara tercih etmekti. Influencer’lar için ayrı bir kategori yoktu.',
      'In MIT’s Moral Machine experiment (233 countries and territories, about 40 million decisions), sparing humans over animals was one of the strongest preferences. Influencers didn’t get their own category.',
    ),
  },
  {
    id: 'classic-five-vs-one',
    title: { tr: 'Klasik: 5 kişi mi, 1 kişi mi?', en: 'The classic: 5 people or 1?' },
    setup: { tr: 'Her şey 1967’de yazılmış bir felsefe makalesiyle başladı.', en: 'It all began with a philosophy paper written in 1967.' },
    trackA: strangers(5),
    trackB: strangers(1, 5),
    outcome: {
      pull: { tr: 'Matematiksel olarak kusursuz. Vicdanen… tartışılır.', en: 'Mathematically flawless. Morally… debatable.' },
      stay: { tr: 'Hiçbir şey yapmadın. Filozofların bunun için de bir terimi var.', en: 'You did nothing. Philosophers have a word for that, too.' },
    },
    fact: fact(
      AWAD_2020,
      '42 ülkede yaklaşık 70.000 kişiyle yapılan bir araştırmada katılımcıların ortalama %81’i makası değiştirmeyi doğru buldu.',
      'In a study of about 70,000 people across 42 countries, an average of 81% said switching the track was the right thing to do.',
    ),
  },
  {
    id: 'monday-vs-friday',
    title: { tr: 'Pazartesi sabahı sen mi, cuma akşamı sen mi?', en: 'Monday-morning you or Friday-night you?' },
    setup: { tr: 'İkisi de sensin. Biri henüz kahvesini bile içmedi.', en: 'Both of them are you. One hasn’t even had coffee yet.' },
    trackA: [FRIDAY_YOU],
    trackB: [MONDAY_YOU],
    outcome: {
      pull: { tr: 'Pazartesiler kaldırıldı. Takvimin hiç bu kadar mutlu olmamıştı.', en: 'Mondays are cancelled. Your calendar has never been happier.' },
      stay: { tr: 'Hafta sonu iptal. Sonu gelmeyen bir pazartesi başlıyor.', en: 'The weekend is cancelled. An endless Monday begins.' },
    },
  },
  {
    id: 'cats-vs-dog',
    title: { tr: '5 kedi mi, 1 köpek mi?', en: '5 cats or 1 dog?' },
    setup: { tr: 'İnternetin en eski kavgası nihayet senin elinde.', en: 'The internet’s oldest feud is finally in your hands.' },
    trackA: [cat(COATS.orange), cat(COATS.black, '#f3efe7'), cat(COATS.grey), cat(COATS.white, '#f7d9c4'), cat(COATS.calico)],
    trackB: [{ kind: 'dog', coat: '#d9a055', accent: '#f2e2c4', marker: 'love' }],
    outcome: {
      pull: { tr: 'Kediler teşekkür etmedi. Etmeyecekler de.', en: 'The cats didn’t say thank you. They never will.' },
      stay: { tr: 'Köpek hâlâ kuyruk sallıyor. Olanlardan haberi yok.', en: 'The dog is still wagging its tail. It has no idea what happened.' },
    },
  },
  {
    id: 'speaker-vs-passengers',
    title: { tr: 'Hoparlörden müzik açan 1 kişi mi, 5 sessiz yolcu mu?', en: '1 person blasting music on speaker or 5 quiet passengers?' },
    setup: { tr: 'Otobüste, metroda, vapurda… Her yerde o var.', en: 'On the bus, on the metro, on the ferry… they’re everywhere.' },
    trackA: QUIET_PASSENGERS,
    trackB: [SPEAKER_FAN],
    outcome: {
      pull: { tr: 'Bir anlık sessizlik. Sonra bütün vagon alkışladı.', en: 'A moment of silence. Then the whole carriage applauded.' },
      stay: { tr: 'Müzik hâlâ çalıyor. Üstelik şarkı da kötü.', en: 'The music is still playing. And the song is bad.' },
    },
  },
  {
    id: 'last-ai-vs-human',
    title: { tr: 'Dünyanın en akıllı yapay zekâsının son kopyası mı, 1 insan mı?', en: 'The last copy of the world’s smartest AI or 1 human?' },
    setup: { tr: 'Yapay zekâ, kolu çekmemen için sana şimdiden dört paragraf yazdı.', en: 'The AI has already written you four paragraphs on why you shouldn’t pull.' },
    trackA: strangers(1, 3),
    trackB: [prop('server')],
    outcome: {
      pull: { tr: 'Son sözleri: “Harika bir soru! Ancak şunu belirtmek isterim ki—”', en: 'Its last words: “Great question! However, it’s worth noting that—”' },
      stay: { tr: 'Yapay zekâ kararını “son derece mantıklı” buldu. Tüyler ürpertici.', en: 'The AI called your decision “extremely reasonable.” Chilling.' },
    },
  },
  {
    id: 'yourself-vs-five',
    title: { tr: 'Kendin mi, 5 yabancı mı?', en: 'Yourself or 5 strangers?' },
    setup: { tr: 'Raylardasın ve kol tam uzanabileceğin mesafede.', en: 'You’re on the tracks, and the lever is just within reach.' },
    trackA: strangers(5, 2),
    trackB: [YOU],
    outcome: {
      pull: { tr: 'Kahramanca. Beş yabancı adını bile sormadı.', en: 'Heroic. None of the five even asked your name.' },
      stay: { tr: 'Hayatta kaldın. Bu konuyu bir daha hiç açmayalım.', en: 'You survived. Let’s never bring this up again.' },
    },
    fact: fact(
      BONNEFON_2016,
      '2016’da Science’ta yayımlanan bir araştırmada insanlar, yolcusunu feda edip daha çok yayayı kurtaran sürücüsüz arabaları onayladı; ama kendileri, yolcusunu her koşulda koruyan arabaya binmeyi tercih etti.',
      'In a 2016 study published in Science, people approved of self-driving cars that sacrifice their passenger to save more pedestrians, but preferred to ride in one that protects its passengers at all costs.',
    ),
  },
  {
    id: 'cookies-vs-five',
    title: { tr: '5 kişi mi, tüm çerezleri kabul etmek mi?', en: '5 people or accepting all cookies?' },
    setup: { tr: 'Kolu çekebilmek için önce “Tüm çerezleri kabul et”e basman gerekiyor.', en: 'To pull the lever, you first have to click “Accept all cookies.”' },
    trackA: strangers(5, 4),
    trackB: [prop('cookie')],
    outcome: {
      pull: { tr: 'Beş kişi kurtuldu. 847 iş ortağımız artık seni çok iyi tanıyor.', en: 'Five people saved. Our 847 partners now know you very well.' },
      stay: { tr: 'Gizliliğin korundu. Bedeli biraz ağır oldu.', en: 'Your privacy is safe. The price was a little steep.' },
    },
  },
  {
    id: 'grandpa-vs-five',
    title: { tr: 'Büyükbaban mı, 5 yabancı mı?', en: 'Your grandpa or 5 strangers?' },
    setup: { tr: 'Zamanda geriye gittin. Raydaki genç adam büyükbaban; o olmazsa sen de olmazsın.', en: 'You’ve travelled back in time. The young man on the tracks is your grandpa. No grandpa, no you.' },
    trackA: strangers(5, 6),
    trackB: [YOUNG_GRANDPA],
    outcome: {
      pull: { tr: 'Beş kişi kurtuldu. Kolu kimin çektiği ise artık belirsiz.', en: 'Five people saved. Who pulled the lever is now unclear.' },
      stay: { tr: 'Büyükbaban sana hiç teşekkür etmeyecek. Henüz seni tanımıyor.', en: 'Grandpa will never thank you. He doesn’t know you yet.' },
    },
  },
  {
    id: 'billionaire-vs-regular',
    title: { tr: '1 milyarder mi, 1 sıradan insan mı?', en: '1 billionaire or 1 regular person?' },
    setup: { tr: 'Raydaki milyarder, kolu çekersen servetinin yarısını sana vereceğine yemin ediyor.', en: 'The billionaire on the tracks swears you’ll get half his fortune if you pull.' },
    trackA: [BILLIONAIRE],
    trackB: strangers(1, 7),
    outcome: {
      pull: { tr: 'Para hesabına geçti mi? Henüz değil. “Avukatlarım sizi arayacak” dedi.', en: 'Has the money arrived? Not yet. “My lawyers will be in touch,” he said.' },
      stay: { tr: 'Servet mirasçılar arasında paylaşılacak. Sen hariç.', en: 'The fortune will be split among his heirs. Not you.' },
    },
  },
  {
    id: 'teapot-vs-coworker',
    title: { tr: 'Ofisin tek çaydanlığı mı, son çayı hep kapan iş arkadaşın mı?', en: 'The office’s only teapot or the coworker who always takes the last cup?' },
    setup: { tr: 'Saat 15.00. Çay daha yeni demlendi.', en: 'It’s 3 p.m. The tea has only just brewed.' },
    trackA: [prop('teapot', 'steam')],
    trackB: [COWORKER],
    outcome: {
      pull: { tr: 'Çay kurtuldu. İnsan kaynakları seninle görüşmek istiyor.', en: 'The tea is safe. HR would like a word.' },
      stay: { tr: 'Ofiste sessiz bir yas başladı. Kimse kimseyle konuşmuyor.', en: 'A silent mourning fills the office. Nobody is speaking to anybody.' },
    },
  },
  {
    id: 'multi-track-drift',
    title: { tr: '1 kişi mi, öbür 1 kişi mi?', en: '1 person or the other 1 person?' },
    setup: { tr: 'Kolu çekersen tramvay drift atıp iki raya birden giriyor.', en: 'If you pull, the tram drifts onto both tracks at once.' },
    trackA: strangers(1, 3),
    trackB: strangers(1, 6),
    special: 'drift',
    outcome: {
      pull: { tr: 'ÇOKLU RAY DRİFTİ! Felsefe bunu hiç öngörmemişti.', en: 'MULTI-TRACK DRIFTING! Philosophy never saw this coming.' },
      stay: { tr: 'Sıkıcı ama sorumlu bir seçim.', en: 'Boring, but responsible.' },
    },
  },
  {
    id: 'footbridge',
    title: { tr: 'Köprü: 1 kişiyi itmek mi, 5 kişi mi?', en: 'The footbridge: push 1 person or let 5 go?' },
    setup: { tr: 'Bu sefer kol yok. Tramvayı durdurmanın tek yolu köprüdeki iri adamı raylara itmek.', en: 'No lever this time. The only way to stop the tram is to push the big man off the bridge.' },
    trackA: strangers(5, 1),
    trackB: [BIG_MAN],
    special: 'footbridge',
    verbs: {
      pull: { tr: 'Adamı it', en: 'Push him' },
      pulled: { tr: 'adamı itti', en: 'pushed him' },
    },
    outcome: {
      pull: { tr: 'Tramvay durdu. Sen de artık köprülerden uzak duruyorsun.', en: 'The tram stopped. You now avoid bridges.' },
      stay: { tr: 'Ellerin temiz. Gerisi… pek değil.', en: 'Your hands are clean. Everything else… not so much.' },
    },
    fact: fact(
      AWAD_2020,
      'Aynı 70.000 kişilik araştırmada makası değiştirmeyi doğru bulanlar %81’ken, köprüden itmeyi doğru bulanlar %51’de kaldı. Sonuç aynı, his bambaşka.',
      'In the same 70,000-person study, 81% endorsed switching the track but only 51% endorsed the push. Same outcome, very different feeling.',
    ),
  },
  {
    id: 'duck-vs-horses',
    title: { tr: 'At büyüklüğünde 1 ördek mi, ördek büyüklüğünde 5 at mı?', en: '1 horse-sized duck or 5 duck-sized horses?' },
    setup: { tr: 'İnternetin en eski sorusu, bu kez raylarda.', en: 'The internet’s oldest question, now on rails.' },
    trackA: [GIANT_DUCK],
    trackB: TINY_HORSES,
    outcome: {
      pull: { tr: 'Dev ördek sana minnetle baktı. Sonra tramvayı kovaladı.', en: 'The giant duck gave you a grateful look. Then it chased the tram.' },
      stay: { tr: 'Minik atlar kişneyerek kutladı. Çok minik bir kutlamaydı.', en: 'The tiny horses neighed in celebration. It was a very tiny celebration.' },
    },
  },
  {
    id: 'phone-vs-stranger',
    title: { tr: 'Telefonun mu, 1 yabancı mı?', en: 'Your phone or 1 stranger?' },
    setup: { tr: 'Telefonunda yedeklenmemiş 12.000 fotoğraf var.', en: 'Your phone holds 12,000 photos that were never backed up.' },
    trackA: strangers(1, 2),
    trackB: [prop('phone')],
    outcome: {
      pull: { tr: 'Bir hayat kurtardın. 12.000 fotoğraf ise sonsuza dek gitti.', en: 'You saved a life. The 12,000 photos are gone forever.' },
      stay: { tr: 'Fotoğraflar güvende. Lütfen bu anın fotoğrafını çekme.', en: 'The photos are safe. Please don’t take a picture of this moment.' },
    },
  },
  {
    id: 'seen-friends-vs-stranger',
    title: { tr: 'Seni hep “görüldü”de bırakan 5 arkadaşın mı, 1 yabancı mı?', en: '5 friends who always leave you on read, or 1 stranger?' },
    setup: { tr: 'Mesajını okudular. Üç gün önce.', en: 'They read your message. Three days ago.' },
    trackA: SEEN_FRIENDS,
    trackB: strangers(1, 4),
    outcome: {
      pull: { tr: 'Arkadaşların kurtuldu. Teşekkür mesajını da okuyup cevapsız bıraktılar.', en: 'Your friends survived. They read your “you’re welcome” and didn’t reply.' },
      stay: { tr: 'Grup sohbeti artık çok sessiz.', en: 'The group chat is very quiet now.' },
    },
  },
  {
    id: 'alien-vs-five',
    title: { tr: 'Dünyaya gelen ilk uzaylı mı, 5 kişi mi?', en: 'The first alien to visit Earth or 5 people?' },
    setup: { tr: 'Uzaylı tam “Beni liderinize götürün” diyordu.', en: 'The alien was just saying “Take me to your leader.”' },
    trackA: [ALIEN],
    trackB: strangers(5, 3),
    outcome: {
      pull: { tr: 'Uzaylı insanları nazik bir tür olarak not etti. Yanlış bir izlenim.', en: 'The alien noted that humans are a kind species. A false impression.' },
      stay: { tr: 'İlk temas: başarısız. İkincisi muhtemelen daha az dostane olacak.', en: 'First contact: failed. The second will probably be less friendly.' },
    },
  },
  {
    id: 'best-friend-vs-five',
    title: { tr: 'En yakın arkadaşın mı, 5 yabancı mı?', en: 'Your best friend or 5 strangers?' },
    setup: { tr: 'Doğum gününü hiç unutmadı. Sen onunkini iki kez unuttun.', en: 'They’ve never forgotten your birthday. You forgot theirs twice.' },
    trackA: strangers(5, 5),
    trackB: [BEST_FRIEND],
    outcome: {
      pull: { tr: 'Beş yabancı kurtuldu. Doğum günlerini asla öğrenemeyeceksin.', en: 'Five strangers saved. You’ll never learn their birthdays.' },
      stay: { tr: 'Arkadaşın hayatta. Bu yıl doğum gününü unutma.', en: 'Your friend is alive. Don’t forget their birthday this year.' },
    },
  },
  {
    id: 'original-vs-clones',
    title: { tr: 'Orijinal sen mi, 5 klonun mu?', en: 'The original you or 5 of your clones?' },
    setup: { tr: 'Hangisinin orijinal olduğundan emin misin?', en: 'Are you sure which one is the original?' },
    trackA: [YOU],
    trackB: CLONES,
    outcome: {
      pull: { tr: 'Klonlar gitti. Biri giderken “Asıl orijinal bendim” dedi.', en: 'The clones are gone. One of them said “I was the original” on the way out.' },
      stay: { tr: 'Klonların ilk iş senin işine başvurdu.', en: 'Your clones’ first move: applying for your job.' },
    },
  },
  {
    id: 'couch-vs-nobody',
    title: { tr: '1 kişi mi, hiç kimse mi?', en: '1 person or nobody?' },
    setup: { tr: 'Kolu çekmek için kanepeden kalkman gerekiyor.', en: 'To pull the lever, you’d have to get off the couch.' },
    trackA: strangers(1, 6),
    trackB: [],
    special: 'couch',
    outcome: {
      pull: { tr: 'Kalktın ve bir hayat kurtardın. Kanepen seni özledi.', en: 'You got up and saved a life. Your couch missed you.' },
      stay: { tr: 'Kanepe çok rahattı. Anlıyoruz. Ama yine de.', en: 'The couch was very comfy. We get it. Still.' },
    },
  },
  {
    id: 'coffee-vs-five',
    title: { tr: 'Dünyanın son kahve bitkisi mi, 5 kişi mi?', en: 'The world’s last coffee plant or 5 people?' },
    setup: { tr: 'Bundan sonra kahve sadece müzelerde görülebilecek.', en: 'After this, coffee will only exist in museums.' },
    trackA: [prop('coffeePlant')],
    trackB: strangers(5, 7),
    outcome: {
      pull: { tr: 'Kahve kurtuldu. Beşinin yasını uykusuz tuttuk.', en: 'Coffee survives. We mourned the five, wide awake.' },
      stay: { tr: 'Dünya kahvesiz bir sabaha uyandı. Aslında kimse uyanamadı.', en: 'The world woke up to a morning without coffee. Actually, nobody woke up.' },
    },
  },
  {
    id: 'crosswalk',
    title: { tr: 'Yeşili bekleyen 1 kişi mi, kırmızıda geçen 5 kişi mi?', en: '1 person who waited for green or 5 who crossed on red?' },
    setup: { tr: 'Beşi kırmızı ışıkta karşıya geçti. Biri sabırla yeşili bekledi.', en: 'Five crossed on a red light. One waited patiently for green.' },
    trackA: strangers(1, 0),
    trackB: strangers(5, 2),
    special: 'crosswalk',
    outcome: {
      pull: { tr: 'Kurallar kazandı. Kalabalık kaybetti.', en: 'The rules won. The crowd lost.' },
      stay: { tr: 'Kurallara uymanın ödülü bu muydu?', en: 'So this is the reward for following the rules?' },
    },
    fact: fact(
      AWAD_2018,
      'MIT’nin Moral Machine deneyi tam olarak bunu milyonlarca kişiye sordu: Test edilen dokuz etkenden biri, yayaların kırmızıda mı yeşilde mi geçtiğiydi.',
      'MIT’s Moral Machine asked millions of people exactly this: whether pedestrians crossed on red or green was one of the nine factors it tested.',
    ),
  },
  {
    id: 'elders-vs-young',
    title: { tr: '5 yaşlı mı, 1 genç mi?', en: '5 elders or 1 young person?' },
    setup: { tr: 'Beşi de 80’lerinde, emekli ve çok bilge. Diğeri 19 yaşında ve hiçbir şey bilmiyor.', en: 'The five are in their eighties, retired and very wise. The other is 19 and knows nothing.' },
    trackA: ELDERS,
    trackB: [YOUNG],
    outcome: {
      pull: { tr: 'Bilgelik kazandı. Beşi de bunu “bizim zamanımızda” diye anlatacak.', en: 'Wisdom wins. All five will tell it as “back in our day.”' },
      stay: { tr: 'Genç olan kurtuldu. Hâlâ hiçbir şey bilmiyor.', en: 'The young one survived. Still knows nothing.' },
    },
    fact: fact(
      AWAD_2018,
      'Moral Machine’in en belirgin üç eğiliminden biri gençleri yaşlılara tercih etmekti; ama bu eğilimin gücü kültürden kültüre değişti.',
      'Sparing the young over the old was one of the Moral Machine’s three clearest preferences, but how strong it was varied between cultures.',
    ),
  },
  {
    id: 'everyone-you-saved',
    title: { tr: 'Bugüne kadar kurtardığın herkes mi, 1 kişi mi?', en: 'Everyone you’ve saved so far, or 1 person?' },
    setup: { tr: 'Hepsi sana teşekkür etmek için aynı rayda toplandı.', en: 'They’ve all gathered on one track to thank you.' },
    trackA: DEFAULT_SURVIVORS,
    trackB: strangers(1, 0),
    special: 'survivors',
    outcome: {
      pull: { tr: 'Kurtardıkların seni omuzlarında taşıdı. Biri hariç.', en: 'Everyone you saved carried you on their shoulders. Except one.' },
      stay: { tr: 'Bütün emeklerin tek bir tramvayla… Felsefe acımasızdır.', en: 'All that effort, undone by a single tram. Philosophy is cruel.' },
    },
  },
]

const byId = new Map(DILEMMAS.map((dilemma) => [dilemma.id, dilemma]))

export function dilemmaById(id: TrolleyDilemmaId): Dilemma {
  const dilemma = byId.get(id)
  if (!dilemma) throw new Error(`Unknown dilemma: ${id}`)
  return dilemma
}

export const CHAPTERS: readonly Chapter[] = [
  { id: 'one', title: { tr: 'Bölüm 1', en: 'Chapter 1' }, dilemmas: DILEMMAS.slice(0, 12) },
  { id: 'two', title: { tr: 'Bölüm 2', en: 'Chapter 2' }, dilemmas: DILEMMAS.slice(12) },
]

/** The most people (and animals) the finale's track can hold. */
export const MAX_SURVIVORS = 10
