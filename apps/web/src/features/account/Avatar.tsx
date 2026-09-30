type AvatarProps = {
  readonly name: string
  readonly image: string | null
  readonly size?: 'sm' | 'lg'
}

const SIZES = { sm: 'size-8 text-[0.8rem]', lg: 'size-14 text-[1.3rem]' } as const

/** The player's picture from their sign-in provider, or their initial. */
export function Avatar({ name, image, size = 'sm' }: AvatarProps) {
  const initial = name.trim().charAt(0).toUpperCase() || '?'
  if (image) {
    return (
      <img
        src={image}
        alt=""
        width={size === 'sm' ? 32 : 56}
        height={size === 'sm' ? 32 : 56}
        referrerPolicy="no-referrer"
        className={`${SIZES[size]} shrink-0 rounded-full object-cover`}
      />
    )
  }
  return (
    <span
      aria-hidden="true"
      className={`${SIZES[size]} grid shrink-0 place-items-center rounded-full bg-teal-600 font-bold text-white`}
    >
      {initial}
    </span>
  )
}
