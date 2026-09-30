import { Link } from '@/app/Link'
import { paths } from '@/app/site'
import { Avatar } from './Avatar'
import { LINK_BUTTON_CLASS, SECONDARY_BUTTON_CLASS } from './formStyles'
import { NicknameForm } from './NicknameForm'
import { useAccount, useSignOut } from './queries'
import { SignInForm } from './SignInForm'
import { suggestNickname } from './suggestNickname'

const PERKS = [
  'Your scores on the global leaderboards',
  'Records and badges that follow you to any device',
  'Daily Challenge streaks',
] as const

/** Sign in, pick a nickname, or see who is signed in — whatever the player needs next. */
export function AccountDialogContent({ onClose }: { readonly onClose: () => void }) {
  const account = useAccount()
  const signOut = useSignOut()

  if (account.status === 'loading' || account.isLoadingProfile) {
    return <div aria-label="Loading your account" className="h-32 animate-pulse rounded-[12px] bg-sunken" />
  }

  if (account.status === 'signedIn' && account.user) {
    if (!account.nickname) {
      return (
        <div>
          <h3 className="text-[1rem] font-bold">Choose your nickname</h3>
          <p className="mt-1 mb-4 text-[0.84rem] text-muted">
            This is how other players see you on the leaderboards. You can change it later.
          </p>
          <NicknameForm
            initialValue={suggestNickname(account.user.name)}
            submitLabel="Save and play"
            onSaved={onClose}
          />
        </div>
      )
    }

    return (
      <div>
        <div className="flex items-center gap-3">
          <Avatar name={account.nickname} image={account.user.image ?? null} size="lg" />
          <div className="min-w-0">
            <p className="truncate text-[1.05rem] font-bold">{account.nickname}</p>
            <p className="truncate text-[0.82rem] text-muted">{account.user.email}</p>
          </div>
        </div>
        <div className="mt-5 grid gap-2.5 sm:grid-cols-2">
          <Link href={paths.profile()} onClick={onClose} className={SECONDARY_BUTTON_CLASS}>
            Profile & badges
          </Link>
          <button
            type="button"
            disabled={signOut.isPending}
            onClick={() => signOut.mutate(undefined, { onSuccess: onClose })}
            className={SECONDARY_BUTTON_CLASS}
          >
            {signOut.isPending ? 'Signing out…' : 'Sign out'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div>
      <ul className="mb-5 space-y-1.5 text-[0.84rem] text-ink-soft">
        {PERKS.map((perk) => (
          <li key={perk} className="flex items-start gap-2">
            <span aria-hidden="true" className="mt-[0.45em] size-1.5 shrink-0 rounded-full bg-teal-500" />
            {perk}
          </li>
        ))}
      </ul>
      <SignInForm />
      <p className="mt-5 text-[0.76rem] leading-relaxed text-subtle">
        No password needed. We only store your email, name and game results —{' '}
        <a href="#privacy" className={LINK_BUTTON_CLASS}>
          privacy policy
        </a>
        .
      </p>
    </div>
  )
}
