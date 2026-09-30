import type { BoardId, MeResponse } from '@games/contract'
import { BADGES, type BadgeId, type BadgeTier } from '@games/trap-the-orb-engine'
import { useState } from 'react'
import { Link } from '@/app/Link'
import { navigate } from '@/app/router'
import { paths } from '@/app/site'
import { BadgeMedal } from '@/games/trap-the-orb/badges/BadgeMedal'
import { badgeContent, badgeGoal, TIER_NAMES } from '@/games/trap-the-orb/badges/badgeContent'
import { BOARD_CONTENT, formatBoardValue, leaderboardsHref, tableLabel } from '@/games/trap-the-orb/leaderboards/boardContent'
import { timeAgo } from '@/games/trap-the-orb/leaderboards/timeAgo'
import { Avatar } from './Avatar'
import { LINK_BUTTON_CLASS, SECONDARY_BUTTON_CLASS } from './formStyles'
import { NicknameForm } from './NicknameForm'
import { useAccount, useDeleteAccount, useSignOut } from './queries'

const MAX_TIER: BadgeTier = 3

/** Highest tier earned per badge. */
function earnedTiers(badges: MeResponse['badges']): ReadonlyMap<BadgeId, BadgeTier> {
  const tiers = new Map<BadgeId, BadgeTier>()
  for (const badge of badges) {
    if (badge.tier > (tiers.get(badge.id) ?? 0)) tiers.set(badge.id, badge.tier)
  }
  return tiers
}

type SectionTitleProps = {
  readonly id: string
  readonly children: string
  readonly aside?: string
}

function SectionTitle({ id, children, aside }: SectionTitleProps) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <h2 id={id} className="text-[1.1rem] font-bold tracking-[-0.01em]">
        {children}
      </h2>
      {aside && <p className="text-[0.8rem] text-muted">{aside}</p>}
    </div>
  )
}

function BadgeGrid({ badges }: { readonly badges: MeResponse['badges'] }) {
  const tiers = earnedTiers(badges)
  const earned = [...tiers.values()].reduce<number>((sum, tier) => sum + tier, 0)

  return (
    <section aria-labelledby="badges-title">
      <SectionTitle id="badges-title" aside={`${earned} of ${BADGES.length * MAX_TIER} tiers`}>
        Badges
      </SectionTitle>
      <ul className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
        {BADGES.map((badge) => {
          const tier = tiers.get(badge.id) ?? 0
          const content = badgeContent(badge.id)
          const nextTier = tier < MAX_TIER ? ((tier + 1) as BadgeTier) : null
          return (
            <li key={badge.id} className="card flex items-center gap-3 px-3.5 py-3">
              <BadgeMedal id={badge.id} tier={tier} />
              <div className="min-w-0">
                <p className="text-[0.88rem] font-bold text-ink">
                  {content.name}{' '}
                  <span className={`text-[0.72rem] font-semibold ${tier === 0 ? 'text-subtle' : 'text-teal-700'}`}>
                    {tier === 0 ? 'Locked' : TIER_NAMES[tier]}
                  </span>
                </p>
                <p className="mt-0.5 text-[0.76rem] leading-snug text-muted">
                  {nextTier ? `${tier === 0 ? '' : 'Next: '}${badgeGoal(badge.id, nextTier)}` : 'Every tier earned!'}
                </p>
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

const BOARD_ORDER = Object.keys(BOARD_CONTENT) as BoardId[]

function Records({ records }: { readonly records: MeResponse['records'] }) {
  const now = new Date()
  const sorted = [...records].sort(
    (a, b) => BOARD_ORDER.indexOf(a.board) - BOARD_ORDER.indexOf(b.board) || a.key.localeCompare(b.key),
  )

  return (
    <section aria-labelledby="records-title">
      <SectionTitle id="records-title">Personal bests</SectionTitle>
      {sorted.length === 0 ? (
        <p className="card mt-3 px-4 py-6 text-center text-[0.86rem] text-muted">
          Finish a ranked run to set your first record.
        </p>
      ) : (
        <ul className="card mt-3 divide-y divide-divider">
          {sorted.map((record) => (
            <li key={record.key} className="flex items-center gap-3 px-4 py-2.5 text-[0.86rem]">
              <Link href={leaderboardsHref(record.board)} className="min-w-0 flex-1 hover:text-teal-700">
                <span className="font-semibold text-ink">{BOARD_CONTENT[record.board].name}</span>
                <span className="text-muted"> · {tableLabel(record.key, now)}</span>
              </Link>
              <span className="hidden text-[0.78rem] text-subtle sm:inline">{timeAgo(record.achievedAt)}</span>
              <span className="tabular font-bold text-ink">{formatBoardValue(record.board, record.value)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function DangerZone() {
  const signOut = useSignOut()
  const deleteAccount = useDeleteAccount()
  const [isConfirming, setIsConfirming] = useState(false)

  return (
    <section aria-labelledby="account-title" className="card px-4 py-4">
      <h2 id="account-title" className="text-[1rem] font-bold">
        Account
      </h2>
      <div className="mt-3 flex flex-wrap gap-2.5">
        <button
          type="button"
          disabled={signOut.isPending}
          onClick={() => signOut.mutate(undefined, { onSuccess: () => navigate(paths.home()) })}
          className={`${SECONDARY_BUTTON_CLASS} w-auto`}
        >
          {signOut.isPending ? 'Signing out…' : 'Sign out'}
        </button>
        {!isConfirming ? (
          <button
            type="button"
            onClick={() => setIsConfirming(true)}
            className={`${LINK_BUTTON_CLASS} px-2 text-danger`}
          >
            Delete account…
          </button>
        ) : (
          <div
            role="alert"
            className="w-full rounded-[10px] bg-coral-400/10 px-3.5 py-3 text-[0.84rem] text-danger"
          >
            <p>This permanently deletes your profile, records and badges. It can’t be undone.</p>
            <div className="mt-2.5 flex flex-wrap gap-2.5">
              <button
                type="button"
                disabled={deleteAccount.isPending}
                onClick={() => deleteAccount.mutate(undefined, { onSuccess: () => navigate(paths.home()) })}
                className="inline-flex h-10 items-center rounded-(--radius-control) bg-coral-600 px-4 font-bold text-white hover:bg-coral-700 disabled:opacity-60"
              >
                {deleteAccount.isPending ? 'Deleting…' : 'Delete forever'}
              </button>
              <button type="button" onClick={() => setIsConfirming(false)} className={`${LINK_BUTTON_CLASS} px-2`}>
                Cancel
              </button>
            </div>
            {deleteAccount.isError && <p className="mt-2">Your account couldn’t be deleted. Please try again.</p>}
          </div>
        )}
      </div>
    </section>
  )
}

/** The signed-in player's nickname, badges and personal bests. */
export function ProfilePage() {
  const account = useAccount()
  const [isEditing, setIsEditing] = useState(false)

  if (account.status === 'loading' || account.isLoadingProfile) {
    return (
      <div aria-label="Loading your profile" className="mx-auto h-64 max-w-[880px] animate-pulse rounded-[16px] bg-sunken" />
    )
  }

  if (account.status !== 'signedIn' || !account.user || !account.me) {
    return (
      <section aria-labelledby="profile-title" className="card mx-auto max-w-[520px] px-6 py-8 text-center">
        <h1 id="profile-title" className="text-[1.4rem] font-extrabold tracking-[-0.02em]">
          Your profile
        </h1>
        <p className="mt-2 text-[0.9rem] text-muted">
          Sign in to keep your records, earn badges and appear on the leaderboards.
        </p>
        <a
          href="#account"
          className="mt-5 inline-flex h-10 items-center rounded-(--radius-control) bg-coral-600 px-5 font-bold text-white shadow-coral hover:bg-coral-700"
        >
          Sign in
        </a>
      </section>
    )
  }

  const { me, user } = account
  const nickname = account.nickname ?? user.name

  return (
    <div className="mx-auto max-w-[880px] space-y-6">
      <section aria-labelledby="profile-title" className="card flex flex-wrap items-center gap-4 px-5 py-5">
        <Avatar name={nickname} image={user.image ?? null} size="lg" />
        <div className="min-w-0 flex-1">
          <h1 id="profile-title" className="truncate text-[1.5rem] font-extrabold tracking-[-0.02em]">
            {nickname}
          </h1>
          <p className="truncate text-[0.84rem] text-muted">{user.email}</p>
        </div>
        <div className="flex items-center gap-3">
          <p className="rounded-full bg-coral-400/10 px-3 py-1 text-[0.8rem] font-bold text-danger">
            ☀ {me.dailyStreak}-day Daily streak
          </p>
          <button type="button" onClick={() => setIsEditing((editing) => !editing)} className={LINK_BUTTON_CLASS}>
            {isEditing ? 'Cancel' : account.nickname ? 'Edit nickname' : 'Choose nickname'}
          </button>
        </div>
        {isEditing && (
          <div className="w-full max-w-[360px]">
            <NicknameForm
              initialValue={account.nickname ?? ''}
              submitLabel="Save nickname"
              onSaved={() => setIsEditing(false)}
            />
          </div>
        )}
      </section>

      <BadgeGrid badges={me.badges} />
      <Records records={me.records} />
      <DangerZone />
    </div>
  )
}
