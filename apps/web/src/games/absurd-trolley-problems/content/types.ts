import type { TrolleyChoice, TrolleyDilemmaId, TrolleyVoteId } from '@games/contract'

export type { TrolleyChoice, TrolleyDilemmaId, TrolleyVoteId }

export type { Lang, Localized } from '@/app/lang'
import type { Localized } from '@/app/lang'

export type HairStyle = 'short' | 'long' | 'bun' | 'spiky' | 'messy' | 'bald'

export type Accessory =
  | 'cap'
  | 'beanie'
  | 'tophat'
  | 'partyhat'
  | 'fedora'
  | 'sunglasses'
  | 'glasses'
  | 'beard'
  | 'mustache'
  | 'phone'
  | 'mug'
  | 'boombox'
  | 'cane'
  | 'book'
  | 'moneybag'
  | 'moneypile'
  | 'chain'
  | 'tie'
  | 'headphones'
  | 'backpack'
  | 'antenna'

/** How a person holds their arms while they wait on the tracks. */
export type Pose = 'stand' | 'phone' | 'cheer' | 'hold' | 'shoulder'

/** A little pixel icon that floats above someone. */
export type Marker = 'heart' | 'you' | 'seen' | 'question' | 'zzz' | 'music' | 'exclaim' | 'steam' | 'love' | 'dollar'

export interface PersonActor {
  readonly kind: 'person'
  readonly skin: string
  readonly hair: HairStyle
  readonly hairColor: string
  readonly top: string
  readonly bottom: string
  readonly shoes: string
  readonly accessories: readonly Accessory[]
  readonly pose: Pose
  /** Colour of a cap or beanie. */
  readonly hatColor?: string
  readonly marker?: Marker
  readonly scale?: number
  /** Big black eyes on green skin. */
  readonly alien?: boolean
}

export interface AnimalActor {
  readonly kind: 'cat' | 'dog' | 'duck' | 'horse'
  readonly coat: string
  /** Second coat colour: a cat's white chest, a dog's ears, a horse's mane. */
  readonly accent: string
  readonly scale?: number
  readonly marker?: Marker
}

export interface PropActor {
  readonly kind: 'server' | 'cookie' | 'teapot' | 'phone' | 'coffeePlant'
  readonly scale?: number
  readonly marker?: Marker
}

export type Actor = PersonActor | AnimalActor | PropActor

/** Scene changes some dilemmas need on top of the actors. */
export type Special = 'drift' | 'footbridge' | 'couch' | 'crosswalk' | 'survivors'

export interface ResearchFact {
  readonly text: Localized
  /** Short citation, e.g. "Awad et al., PNAS (2020)". */
  readonly source: string
  readonly url: string
}

export interface Dilemma<Id extends string = TrolleyDilemmaId> {
  readonly id: Id
  /** The question, shown big above the scene. */
  readonly title: Localized
  /** One line of setup under the title. */
  readonly setup: Localized
  /** Where the tram goes if nobody touches anything. */
  readonly trackA: readonly Actor[]
  /** Where it goes if you pull the lever. */
  readonly trackB: readonly Actor[]
  /** A one-liner for what you chose, shown with the result. */
  readonly outcome: Readonly<Record<TrolleyChoice, Localized>>
  readonly fact?: ResearchFact
  /** Button and result wording when the action is not a lever (the footbridge). */
  readonly verbs?: {
    readonly pull: Localized
    readonly pulled: Localized
    /** The other button, when doing nothing has a name of its own (refusing). */
    readonly stay?: Localized
    /** How the result starts, for each choice: “You steered away.” */
    readonly you?: Readonly<Record<TrolleyChoice, Localized>>
  }
  readonly special?: Special
  /**
   * Nobody is counted as a victim, whatever is chosen: the abortion debate's
   * operations, where whether the unborn should count is the very question.
   */
  readonly uncounted?: boolean
}

/** A dilemma from any set: the absurd ones, or Philippa Foot's. */
export type AnyDilemma = Dilemma<string>

export interface Chapter {
  readonly id: 'one' | 'two'
  readonly title: Localized
  readonly dilemmas: readonly Dilemma[]
}

/** A chapter from any set: the absurd game's two, or Philippa Foot's cases as one. */
export interface AnyChapter {
  readonly id: string
  readonly title: Localized
  readonly dilemmas: readonly AnyDilemma[]
}

/** Lives lost: a prop (a phone, a teapot, an AI) is mourned, but not counted. */
export function livesOf(actors: readonly Actor[]): number {
  return actors.filter((actor) => actor.kind === 'person' || actor.kind === 'cat' || actor.kind === 'dog' || actor.kind === 'duck' || actor.kind === 'horse').length
}
