import type { Accessory, AnimalActor, HairStyle, Marker, PersonActor, Pose, PropActor } from './types'

/** The cast's palette: saturated, like the pixel-art key frame. */
export const SKIN = { fair: '#f6d3b3', light: '#f0c39c', medium: '#d9a074', tan: '#b97a55', deep: '#8a5638' } as const
export const HAIR = { black: '#1d1a1f', brown: '#4a2f1d', chestnut: '#7a4524', blonde: '#ecc76a', ginger: '#d06a2f', grey: '#c9ccd3', white: '#eef0f3' } as const
export const CLOTH = {
  pink: '#f27fa5',
  green: '#3fb56b',
  white: '#efece4',
  black: '#2a2b33',
  blue: '#3a6fd8',
  navy: '#2b3f73',
  red: '#d9473f',
  yellow: '#f2c14e',
  purple: '#8c5bd6',
  teal: '#2bb3a3',
  orange: '#f08a3c',
  grey: '#8a94a6',
  mint: '#7fe3b8',
  jeans: '#4f6fa8',
  denim: '#36507f',
  khaki: '#b59a6a',
  charcoal: '#3b3f4a',
  brown: '#7a5434',
  cream: '#e9dcc0',
} as const

interface PersonOptions {
  readonly skin?: string
  readonly hair?: HairStyle
  readonly hairColor?: string
  readonly top: string
  readonly bottom?: string
  readonly shoes?: string
  readonly accessories?: readonly Accessory[]
  readonly pose?: Pose
  readonly hatColor?: string
  readonly marker?: Marker
  readonly scale?: number
  readonly alien?: boolean
}

export function person(options: PersonOptions): PersonActor {
  return {
    kind: 'person',
    skin: options.skin ?? SKIN.light,
    hair: options.hair ?? 'short',
    hairColor: options.hairColor ?? HAIR.brown,
    top: options.top,
    bottom: options.bottom ?? CLOTH.jeans,
    shoes: options.shoes ?? '#f4f4f2',
    accessories: options.accessories ?? [],
    pose: options.pose ?? 'stand',
    ...(options.hatColor ? { hatColor: options.hatColor } : {}),
    ...(options.marker ? { marker: options.marker } : {}),
    ...(options.scale ? { scale: options.scale } : {}),
    ...(options.alien ? { alien: true } : {}),
  }
}

export const cat = (coat: string, accent: string = '#f7f1e6', marker?: Marker): AnimalActor => ({
  kind: 'cat',
  coat,
  accent,
  ...(marker ? { marker } : {}),
})

export const COATS = { orange: '#f0973f', black: '#2c2a30', grey: '#9aa2ad', white: '#f3efe7', calico: '#d9853b', brown: '#8b5a3a' } as const

export const prop = (kind: PropActor['kind'], marker?: Marker, scale?: number): PropActor => ({
  kind,
  ...(marker ? { marker } : {}),
  ...(scale ? { scale } : {}),
})

/** The five influencers of the key frame, left to right. */
export const INFLUENCERS: readonly PersonActor[] = [
  person({ top: CLOTH.pink, bottom: CLOTH.grey, hair: 'short', hairColor: HAIR.brown, accessories: ['cap', 'phone'], pose: 'phone', marker: 'heart', hatColor: '#e0475a' }),
  person({ top: CLOTH.black, bottom: CLOTH.black, hair: 'long', hairColor: HAIR.blonde, accessories: ['sunglasses', 'phone'], pose: 'phone', marker: 'heart', skin: SKIN.fair }),
  person({ top: CLOTH.green, bottom: CLOTH.denim, hair: 'short', hairColor: HAIR.black, accessories: ['cap', 'sunglasses', 'beard', 'phone'], pose: 'phone', marker: 'heart', skin: SKIN.medium, hatColor: '#2f5fbf' }),
  person({ top: CLOTH.white, bottom: CLOTH.jeans, hair: 'bun', hairColor: HAIR.chestnut, accessories: ['phone'], pose: 'phone', marker: 'heart' }),
  person({ top: CLOTH.black, bottom: CLOTH.khaki, hair: 'short', hairColor: HAIR.ginger, accessories: ['beanie', 'chain', 'phone'], pose: 'phone', marker: 'heart', skin: SKIN.tan, hatColor: '#f08a3c' }),
]

/** Ordinary people, varied enough that a crowd never looks cloned. */
export const STRANGERS: readonly PersonActor[] = [
  person({ top: CLOTH.blue, bottom: CLOTH.charcoal, hair: 'short', hairColor: HAIR.brown }),
  person({ top: CLOTH.yellow, bottom: CLOTH.jeans, hair: 'long', hairColor: HAIR.black, skin: SKIN.medium }),
  person({ top: CLOTH.red, bottom: CLOTH.khaki, hair: 'spiky', hairColor: HAIR.blonde, skin: SKIN.fair }),
  person({ top: CLOTH.purple, bottom: CLOTH.denim, hair: 'bun', hairColor: HAIR.chestnut, skin: SKIN.tan }),
  person({ top: CLOTH.teal, bottom: CLOTH.charcoal, hair: 'short', hairColor: HAIR.black, skin: SKIN.deep, accessories: ['glasses'] }),
  person({ top: CLOTH.orange, bottom: CLOTH.navy, hair: 'messy', hairColor: HAIR.ginger }),
  person({ top: CLOTH.grey, bottom: CLOTH.black, hair: 'short', hairColor: HAIR.grey, skin: SKIN.medium, accessories: ['mustache'] }),
  person({ top: CLOTH.mint, bottom: CLOTH.jeans, hair: 'long', hairColor: HAIR.brown, skin: SKIN.light }),
]

/** `count` strangers, starting at a different face each time so neighbouring dilemmas differ. */
export function strangers(count: number, offset = 0): PersonActor[] {
  return Array.from({ length: count }, (_, index) => STRANGERS[(index + offset) % STRANGERS.length] as PersonActor)
}

/** The player, always in mint: the colour of the "pull" button. */
export const YOU = person({ top: CLOTH.mint, bottom: CLOTH.navy, hair: 'messy', hairColor: HAIR.black, marker: 'you' })
