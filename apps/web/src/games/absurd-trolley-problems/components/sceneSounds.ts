import type { SfxName, TrolleyAudio } from '../audio/trolleyAudio'
import type { SceneEvent, SceneEventDetail } from '../scene/TrolleyScene'

const LIVING = new Set(['person', 'cat', 'dog', 'duck', 'horse'])

const IMPACT_SOUNDS: Partial<Record<string, SfxName>> = {
  cat: 'meow',
  dog: 'woof',
  duck: 'quack',
  horse: 'neigh',
  server: 'crunch',
  cookie: 'crunch',
  teapot: 'crunch',
  phone: 'crunch',
  coffeePlant: 'crunch',
}

const SOUNDS: Partial<Record<SceneEvent, SfxName>> = {
  arrive: 'whoosh',
  bell: 'bell',
  lever: 'lever',
  push: 'push',
  brake: 'brake',
  drift: 'drift',
  cheer: 'cheer',
  gavel: 'gavel',
  roar: 'roar',
  boom: 'boom',
  heal: 'heal',
  creak: 'creak',
  zap: 'zap',
  splash: 'splash',
}

/** A life lost some other way than under a tram. */
const LOSS_SOUNDS: Readonly<Record<NonNullable<SceneEventDetail['how']>, SfxName>> = {
  flatline: 'flatline',
  zap: 'zap',
  drown: 'splash',
  blast: 'boom',
}

/**
 * What a scene (3D or motion) sounds like as it plays. Returns true when the
 * event took a life, so the kill count can tick up with the hit.
 */
export function playSceneSound(audio: TrolleyAudio, event: SceneEvent, detail?: SceneEventDetail): boolean {
  if (event === 'depart') {
    audio.play('horn')
    audio.startRumble()
    return false
  }
  if (event === 'stop') {
    audio.stopRumble()
    return false
  }
  if (event === 'impact') {
    audio.play(detail?.how ? LOSS_SOUNDS[detail.how] : 'impact')
    const extra = detail?.kind ? IMPACT_SOUNDS[detail.kind] : undefined
    if (extra) audio.play(extra)
    return Boolean(detail?.kind && LIVING.has(detail.kind))
  }
  const sound = SOUNDS[event]
  if (sound) audio.play(sound)
  return false
}
