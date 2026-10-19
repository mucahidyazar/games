import { useLang } from '@/app/lang'

/** The "How to play" dialog for Absurd Trolley Problems, in the site's language. */
export function HowToPlayContent() {
  if (useLang() === 'tr') {
    return (
      <>
        <p>
          Kontrolden çıkan bir tramvay A rayına doğru gidiyor. <strong>Kolu çekersen</strong> (<kbd>A</kbd>) B rayına
          sapar; <strong>dokunmazsan</strong> (<kbd>D</kbd>) yoluna devam eder. Raylarda kim varsa sonucuna katlanır.
        </p>
        <h3>Oyuncular</h3>
        <p>
          Oyun “Kim oynuyor?” ekranıyla açılır. <strong>Yeni oyun</strong> ile herkes kendi adıyla oynar; eşin, annen ya da
          ev arkadaşın aynı cihazda ayrı bir oyun açabilir. <strong>Karşılaştır</strong> sekmesi iki oyuncunun ikisinin de
          oynadığı ikilemlerdeki seçimlerini yan yana gösterir. Oyuncular yalnızca bu cihazda saklanır.
        </p>
        <h3>İki problem seti</h3>
        <p>
          Oyuncuyu seçince sıra problemlere gelir. <strong>Absürt ikilemler</strong> 3D piksel bir dünyada, her biri on iki
          ikilemden oluşan iki bölümdür; bölüm sonunda kaybedilen canlar ve ahlaki profilin seni bekler.{' '}
          <strong>Orijinal problemler</strong>, tramvay probleminin doğduğu Philippa Foot makalesindeki (1967) yirmi bir seçimi
          hareketli çizimlerle oynatır: her kararın ardından Foot’un cevabını ve gerekçesini görürsün; sonunda seçimlerin Foot’un
          zarar vermek ile yardım etmek arasına çizdiği çizgiye göre gruplanır. Kürtaj tartışmasındaki ameliyatlarda kurban
          sayılmaz: doğmamış çocuğun sayılıp sayılmayacağı tartışmanın kendisidir. Karşılaştır’da Foot’un kendisini de seçebilirsin. Her kararın ardından topluluğun ne yaptığını da görürsün; <kbd>Enter</kbd> sonrakine geçer.
        </p>
        <h3>Oylar</h3>
        <p>
          Oylar anonimdir: tarayıcın her oyuncu için yalnızca rastgele bir kimlik saklar, böylece her oyuncu bir ikileme
          bir oy verir; tekrar oynarsan oyun yeni seçiminle değişir. Bazı ikilemlerdeki araştırma notları gerçek çalışmalara dayanır ve kaynaklarına bağlanır.
        </p>
        <h3>Ayarlar</h3>
        <p>
          Sesi üstteki hoparlör düğmesiyle ya da <kbd>M</kbd> ile kapatabilirsin; müziği nota düğmesi açar ve kapatır.
          TR | EN düğmesi Türkçe ile İngilizce arasında geçiş yapar.
        </p>
      </>
    )
  }
  return (
    <>
      <p>
        A runaway tram is heading down track A. <strong>Pull the lever</strong> (<kbd>A</kbd>) and it swerves onto
        track B; <strong>do nothing</strong> (<kbd>D</kbd>) and it carries on. Whoever is on its track has a bad day.
      </p>
      <h3>Players</h3>
      <p>
        The game opens on “Who’s playing?”. With <strong>New game</strong> everyone plays under their own name, so your
        partner, your mum or your flatmate can have their own game on the same device. The <strong>Compare</strong> tab
        puts two players’ choices side by side on the dilemmas they have both played. Players are kept on this device only.
      </p>
      <h3>Two sets of problems</h3>
      <p>
        Once you have picked a player, you pick the problems. <strong>Absurd dilemmas</strong> are two chapters of twelve in a
        3D pixel world, each ending with the lives lost and your moral profile. <strong>The original problems</strong> are the
        twenty-one choices in Philippa Foot’s 1967 essay, where the trolley problem was born, drawn in motion: after each one you
        see Foot’s own answer and her reasoning, and at the end your calls are grouped by the line she draws between harming and
        helping. Nobody is counted as a victim in the operations of the abortion debate: whether the unborn should count is the
        debate itself. In Compare you can pick Foot herself. After every choice you also see what
        everyone else did; <kbd>Enter</kbd> moves on.
      </p>
      <h3>Votes</h3>
      <p>
        Votes are anonymous: your browser only keeps a random id for each player, so each player votes once per
        dilemma, and playing one again replaces your vote.
        The research notes on some dilemmas come from real studies and link to their sources.
      </p>
      <h3>Settings</h3>
      <p>
        Mute everything with the speaker button in the header or <kbd>M</kbd>; the note button turns the music on or
        off. TR | EN switches between Turkish and English.
      </p>
    </>
  )
}
