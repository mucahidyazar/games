import { site } from '@/app/site'
import { LogoMark } from './Logo'
import { PortalMark } from './PortalMark'

type BrandProps = {
  /** 'header' is one step bigger than 'footer'. */
  readonly size?: 'header' | 'footer'
  /** A standalone game uses its brand as the page heading. */
  readonly asHeading?: boolean
  /** The portal hero is always dark, including when the light site theme is selected. */
  readonly onDark?: boolean
}

/**
 * The site's name with its mark, for light text on the dark header and
 * footer: the portal's wordmark, or the game's name on the game's own site.
 */
export function Brand({ size = 'header', asHeading = false, onDark = false }: BrandProps) {
  const mark = size === 'header' ? 'size-8 lg:size-9' : 'size-7'
  const text = size === 'header' ? 'text-[1.06rem] lg:text-[1.18rem]' : 'text-[1rem]'
  const Name = asHeading ? 'h1' : 'span'

  if (site.kind === 'portal') {
    return (
      <span className="flex items-center gap-2.5">
        <PortalMark className={`${mark} shrink-0`} />
        <Name className={`${text} font-extrabold tracking-[-0.02em] whitespace-nowrap ${onDark ? 'text-white' : 'text-[var(--chrome-fg)]'}`}>
          games<span className={`${size === 'header' ? 'max-[399px]:block max-[399px]:text-[0.6rem] max-[399px]:leading-none ' : ''}font-semibold opacity-65`}>.mucahid.dev</span>
        </Name>
      </span>
    )
  }

  return (
    <span className="flex items-center gap-2.5">
      <LogoMark className={`${mark} shrink-0`} />
      <Name className={`${text} font-extrabold tracking-[-0.025em] whitespace-nowrap max-[399px]:max-w-[82px] max-[399px]:text-[0.9rem] max-[399px]:leading-tight max-[399px]:whitespace-normal ${onDark ? 'text-white' : 'text-[var(--chrome-fg)]'}`}>
        {site.name}
      </Name>
    </span>
  )
}
