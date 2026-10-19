import { CHROME } from '@/app/copy'
import { useLang } from '@/app/lang'
import { Link } from '@/app/Link'
import { paths } from '@/app/site'
import { UserIcon } from '@/components/icons'
import { Avatar } from './Avatar'
import { useAccount } from './queries'

type AccountButtonProps = {
  /** The pixel-art styling a game's own header uses. */
  readonly variant?: 'chrome' | 'pixel'
}

/** Header entry point: "Sign in" for guests, the player's avatar and nickname once signed in. */
export function AccountButton({ variant = 'chrome' }: AccountButtonProps) {
  const account = useAccount()
  const lang = useLang()
  const pixel = variant === 'pixel'

  if (account.status === 'loading') {
    return <span aria-hidden="true" className={pixel ? 'atp-signin is-loading' : 'size-9 animate-pulse rounded-full bg-[var(--chrome-border)] motion-reduce:animate-none'} />
  }
  if (account.status === 'anonymous' || !account.user) {
    return (
      <a
        href="#account"
        aria-label={CHROME.account.signIn[lang]}
        className={
          pixel
            ? 'atp-signin'
            : 'inline-flex h-9 min-w-9 items-center justify-center gap-1.5 rounded-full bg-action px-2 text-[0.82rem] font-bold whitespace-nowrap text-on-action transition hover:opacity-90 active:scale-[0.97] min-[360px]:px-3.5'
        }
      >
        {/* The narrowest phones get an icon; the label comes back from 360px. */}
        <UserIcon className="size-[18px] min-[360px]:hidden" />
        <span className="sr-only min-[360px]:not-sr-only">{CHROME.account.signIn[lang]}</span>
      </a>
    )
  }

  const name = account.nickname ?? account.user.name
  return (
    <Link
      href={paths.profile()}
      aria-label={`${CHROME.account.profile[lang]}: ${name}`}
      className={
        pixel
          ? 'atp-profile'
          : 'inline-flex h-9 items-center gap-2 rounded-full py-0.5 pr-0.5 pl-0.5 text-[0.84rem] font-semibold text-[var(--chrome-fg)] opacity-90 transition hover:bg-[var(--chrome-border)] hover:opacity-100 sm:pr-3'
      }
    >
      <Avatar name={name} image={account.user.image ?? null} />
      <span className="hidden max-w-[12ch] truncate sm:inline">{name}</span>
    </Link>
  )
}
