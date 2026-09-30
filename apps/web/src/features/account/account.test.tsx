import { isoWeekKey, utcDateKey, type MeResponse } from '@games/contract'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/lib/api/client'
import { AccountButton } from './AccountButton'
import { AccountDialogContent } from './AccountDialogContent'
import { authClient } from './authClient'
import { NicknameForm } from './NicknameForm'
import { ProfilePage } from './ProfilePage'
import { useAccount, useAuthConfig, useDeleteAccount, useSignOut, useUpdateNickname } from './queries'
import { SignInForm } from './SignInForm'
import { suggestNickname } from './suggestNickname'

vi.mock('./queries', () => ({
  useAccount: vi.fn(),
  useAuthConfig: vi.fn(),
  useUpdateNickname: vi.fn(),
  useSignOut: vi.fn(),
  useDeleteAccount: vi.fn(),
}))

vi.mock('./authClient', () => ({
  authClient: {
    signIn: { social: vi.fn(), emailOtp: vi.fn() },
    emailOtp: { sendVerificationOtp: vi.fn() },
  },
}))

type Account = ReturnType<typeof useAccount>

const USER = { id: 'u1', name: 'Ada Lovelace', email: 'ada@example.com', image: null }

const ME: MeResponse = {
  user: USER,
  profile: { nickname: 'Ada' },
  badges: [
    { id: 'squeeze', tier: 1, earnedAt: '2026-09-20T10:00:00.000Z' },
    { id: 'squeeze', tier: 2, earnedAt: '2026-09-22T10:00:00.000Z' },
    { id: 'climber', tier: 3, earnedAt: '2026-09-21T10:00:00.000Z' },
  ],
  records: [
    { board: 'score.classic', key: 'score.classic:all', value: 48_200, achievedAt: '2026-09-21T10:00:00.000Z' },
    {
      board: 'score.classic',
      key: `score.classic:week:${isoWeekKey(new Date())}`,
      value: 12_000,
      achievedAt: '2026-09-23T10:00:00.000Z',
    },
    {
      board: 'score.daily',
      key: `score.daily:day:${utcDateKey(new Date())}`,
      value: 3_100,
      achievedAt: '2026-09-24T01:00:00.000Z',
    },
    { board: 'score.hardcore', key: 'score.hardcore:week:2026-W30', value: 900, achievedAt: '2026-07-21T10:00:00.000Z' },
    { board: 'stat.tightestTrap', key: 'stat.tightestTrap:all', value: 0.62, achievedAt: '2026-09-21T10:00:00.000Z' },
  ],
  dailyStreak: 3,
  dailyPlayedToday: true,
}

const account = (overrides: Partial<Account>): Account =>
  ({
    status: 'anonymous',
    user: null,
    me: null,
    nickname: null,
    isLoadingProfile: false,
    refetchSession: vi.fn(),
    ...overrides,
  }) as Account

const signedIn = (overrides: Partial<Account> = {}): Account =>
  account({ status: 'signedIn', user: USER as Account['user'], me: ME, nickname: 'Ada', ...overrides })

const mockMutations = () => {
  const updateNickname = { mutateAsync: vi.fn().mockResolvedValue({ nickname: 'Luna' }), isPending: false }
  const signOut = { mutate: vi.fn(), isPending: false }
  const deleteAccount = { mutate: vi.fn(), isPending: false, isError: false }
  vi.mocked(useUpdateNickname).mockReturnValue(updateNickname as unknown as ReturnType<typeof useUpdateNickname>)
  vi.mocked(useSignOut).mockReturnValue(signOut as unknown as ReturnType<typeof useSignOut>)
  vi.mocked(useDeleteAccount).mockReturnValue(deleteAccount as unknown as ReturnType<typeof useDeleteAccount>)
  return { updateNickname, signOut, deleteAccount }
}

const mockConfig = (state: { isPending?: boolean; isError?: boolean; google?: boolean; email?: boolean }) => {
  const { isPending = false, isError = false, google = true, email = true } = state
  vi.mocked(useAuthConfig).mockReturnValue({
    isPending,
    isError,
    data: isPending || isError ? undefined : { auth: { google, email } },
  } as unknown as ReturnType<typeof useAuthConfig>)
}

afterEach(() => {
  vi.clearAllMocks()
  window.history.replaceState(null, '', '/')
})

describe('suggestNickname', () => {
  it('turns a sign-in name into a valid nickname', () => {
    expect(suggestNickname('Ada Lovelace!')).toBe('Ada Lovelace')
    expect(suggestNickname('__Neo')).toBe('Neo')
    expect(suggestNickname('Bartholomew Montgomery')).toBe('Bartholomew Mont')
    expect(suggestNickname('Al')).toBe('')
  })
})

describe('AccountButton', () => {
  it('shows a placeholder while the session loads', () => {
    vi.mocked(useAccount).mockReturnValue(account({ status: 'loading' }))
    render(<AccountButton />)

    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })

  it('invites guests to sign in', () => {
    vi.mocked(useAccount).mockReturnValue(account({}))
    render(<AccountButton />)

    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '#account')
  })

  it('links signed-in players to their profile', () => {
    vi.mocked(useAccount).mockReturnValue(signedIn())
    render(<AccountButton />)

    expect(screen.getByRole('link', { name: 'Your profile: Ada' })).toHaveAttribute('href', '/profile')
  })
})

describe('AccountDialogContent', () => {
  it('shows a placeholder while the account loads', () => {
    mockMutations()
    vi.mocked(useAccount).mockReturnValue(account({ status: 'loading' }))
    render(<AccountDialogContent onClose={vi.fn()} />)

    expect(screen.getByLabelText('Loading your account')).toBeInTheDocument()
  })

  it('offers both sign-in methods to guests', () => {
    mockMutations()
    mockConfig({})
    vi.mocked(useAccount).mockReturnValue(account({}))
    render(<AccountDialogContent onClose={vi.fn()} />)

    expect(screen.getByText('Your scores on the global leaderboards')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Continue with Google' })).toBeInTheDocument()
    expect(screen.getByLabelText('Email')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'privacy policy' })).toHaveAttribute('href', '#privacy')
  })

  it('asks new players for a nickname, suggesting one from their name', async () => {
    const { updateNickname } = mockMutations()
    vi.mocked(useAccount).mockReturnValue(signedIn({ nickname: null }))
    const onClose = vi.fn()
    const user = userEvent.setup()
    render(<AccountDialogContent onClose={onClose} />)

    expect(screen.getByLabelText('Nickname')).toHaveValue('Ada Lovelace')
    await user.click(screen.getByRole('button', { name: 'Save and play' }))

    expect(updateNickname.mutateAsync).toHaveBeenCalledWith('Ada Lovelace')
    expect(onClose).toHaveBeenCalled()
  })

  it('shows who is signed in and signs out', async () => {
    const { signOut } = mockMutations()
    vi.mocked(useAccount).mockReturnValue(signedIn())
    const onClose = vi.fn()
    const user = userEvent.setup()
    render(<AccountDialogContent onClose={onClose} />)

    expect(screen.getByText('ada@example.com')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Profile & badges' })).toHaveAttribute('href', '/profile')
    await user.click(screen.getByRole('button', { name: 'Sign out' }))

    expect(signOut.mutate).toHaveBeenCalledWith(undefined, { onSuccess: onClose })
  })
})

describe('SignInForm', () => {
  it('shows a placeholder while the options load', () => {
    mockConfig({ isPending: true })
    render(<SignInForm />)

    expect(screen.getByLabelText('Loading sign-in options')).toBeInTheDocument()
  })

  it('explains when accounts are unavailable', () => {
    mockConfig({ isError: true })
    render(<SignInForm />)

    expect(screen.getByText(/accounts are unavailable right now/i)).toBeInTheDocument()
  })

  it('only shows the methods the server supports', () => {
    mockConfig({ google: false, email: true })
    render(<SignInForm />)

    expect(screen.queryByRole('button', { name: 'Continue with Google' })).not.toBeInTheDocument()
    expect(screen.queryByText('or')).not.toBeInTheDocument()
  })

  it('sends players to Google and back to this dialog', async () => {
    mockConfig({})
    vi.mocked(authClient.signIn.social).mockResolvedValue({ data: null, error: null } as never)
    const user = userEvent.setup()
    render(<SignInForm />)

    await user.click(screen.getByRole('button', { name: 'Continue with Google' }))

    expect(authClient.signIn.social).toHaveBeenCalledWith({
      provider: 'google',
      callbackURL: '/#account',
      errorCallbackURL: '/#account',
    })
  })

  it('shows Google errors and rate limits', async () => {
    mockConfig({})
    vi.mocked(authClient.signIn.social).mockResolvedValue({ data: null, error: { status: 429, message: '' } } as never)
    const user = userEvent.setup()
    render(<SignInForm />)

    await user.click(screen.getByRole('button', { name: 'Continue with Google' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/too many attempts/i)
  })

  it('mentions a sign-in that did not finish', () => {
    window.history.replaceState(null, '', '/?error=access_denied')
    mockConfig({})
    render(<SignInForm />)

    expect(screen.getByRole('alert')).toHaveTextContent(/sign-in didn’t finish/i)
  })

  it('signs in with a code sent by email', async () => {
    mockConfig({ google: false })
    vi.mocked(authClient.emailOtp.sendVerificationOtp).mockResolvedValue({ data: { success: true }, error: null } as never)
    vi.mocked(authClient.signIn.emailOtp)
      .mockResolvedValueOnce({ data: null, error: { status: 400, message: 'Invalid OTP' } } as never)
      .mockResolvedValueOnce({ data: {}, error: null } as never)
    const user = userEvent.setup()
    render(<SignInForm />)

    await user.type(screen.getByLabelText('Email'), 'not-an-email')
    await user.click(screen.getByRole('button', { name: /email me a sign-in code/i }))
    expect(screen.getByRole('alert')).toHaveTextContent(/valid email/i)

    await user.clear(screen.getByLabelText('Email'))
    await user.type(screen.getByLabelText('Email'), ' Ada@Example.com ')
    await user.click(screen.getByRole('button', { name: /email me a sign-in code/i }))
    expect(authClient.emailOtp.sendVerificationOtp).toHaveBeenCalledWith({ email: 'ada@example.com', type: 'sign-in' })
    expect(await screen.findByText('ada@example.com')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /resend in 30s/i })).toBeDisabled()

    await user.type(screen.getByLabelText('Sign-in code'), '12a345')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))
    expect(screen.getByRole('alert')).toHaveTextContent(/6-digit code/i)

    await user.type(screen.getByLabelText('Sign-in code'), '6')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))
    expect(authClient.signIn.emailOtp).toHaveBeenCalledWith({ email: 'ada@example.com', otp: '123456' })
    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid OTP')

    await user.click(screen.getByRole('button', { name: 'Sign in' }))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Use a different email' }))
    expect(screen.getByLabelText('Email')).toBeInTheDocument()
  })

  it('explains when the code could not be sent', async () => {
    mockConfig({ google: false })
    vi.mocked(authClient.emailOtp.sendVerificationOtp).mockResolvedValue({
      data: null,
      error: { status: 500, message: '' },
    } as never)
    const user = userEvent.setup()
    render(<SignInForm />)

    await user.type(screen.getByLabelText('Email'), 'ada@example.com')
    await user.click(screen.getByRole('button', { name: /email me a sign-in code/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/couldn’t send the code/i)
  })
})

describe('NicknameForm', () => {
  it('checks the nickname before saving', async () => {
    const { updateNickname } = mockMutations()
    const user = userEvent.setup()
    render(<NicknameForm initialValue="" submitLabel="Save" />)

    await user.type(screen.getByLabelText('Nickname'), 'Al')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(screen.getByLabelText('Nickname')).toHaveAttribute('aria-invalid', 'true')
    expect(updateNickname.mutateAsync).not.toHaveBeenCalled()
  })

  it('reports the saved nickname', async () => {
    mockMutations()
    const onSaved = vi.fn()
    const user = userEvent.setup()
    render(<NicknameForm initialValue="Luna" submitLabel="Save" onSaved={onSaved} />)

    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(onSaved).toHaveBeenCalledWith('Luna')
  })

  it.each([
    [new ApiError('nickname_taken', 'Taken', 409), /taken/i],
    [new ApiError('nickname_not_allowed', 'Not allowed', 422), /please pick another one/i],
    [new ApiError('invalid_nickname', 'Invalid', 400), /isn’t allowed/i],
    [new ApiError('network', 'Offline', 0), /can’t be reached/i],
    [new Error('boom'), /couldn’t be saved/i],
  ])('explains save failures (%s)', async (error, message) => {
    const { updateNickname } = mockMutations()
    updateNickname.mutateAsync.mockRejectedValueOnce(error)
    const user = userEvent.setup()
    render(<NicknameForm initialValue="Luna" submitLabel="Save" />)

    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByText(message)).toBeInTheDocument()
  })
})

describe('ProfilePage', () => {
  it('shows a placeholder while the profile loads', () => {
    mockMutations()
    vi.mocked(useAccount).mockReturnValue(signedIn({ isLoadingProfile: true }))
    render(<ProfilePage />)

    expect(screen.getByLabelText('Loading your profile')).toBeInTheDocument()
  })

  it('invites guests to sign in', () => {
    mockMutations()
    vi.mocked(useAccount).mockReturnValue(account({}))
    render(<ProfilePage />)

    expect(screen.getByRole('heading', { level: 1, name: 'Your profile' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '#account')
  })

  it('shows the nickname, streak, badges and personal bests', () => {
    mockMutations()
    vi.mocked(useAccount).mockReturnValue(signedIn())
    render(<ProfilePage />)

    expect(screen.getByRole('heading', { level: 1, name: 'Ada' })).toBeInTheDocument()
    expect(screen.getByText(/3-day Daily streak/)).toBeInTheDocument()

    const badges = screen.getByRole('region', { name: 'Badges' })
    expect(within(badges).getByText('5 of 36 tiers')).toBeInTheDocument()
    expect(within(badges).getByRole('img', { name: 'Tight Squeeze, Silver' })).toBeInTheDocument()
    expect(within(badges).getByText('Next: Trap an orb in 0.75% of the field or less')).toBeInTheDocument()
    expect(within(badges).getByText('Every tier earned!')).toBeInTheDocument()
    expect(within(badges).getByText('Reach level 3 in Hardcore')).toBeInTheDocument()

    const records = screen.getByRole('region', { name: 'Personal bests' })
    expect(within(records).getByText('48,200')).toBeInTheDocument()
    expect(within(records).getByText(/This week/)).toBeInTheDocument()
    expect(within(records).getByText(/Today/)).toBeInTheDocument()
    expect(within(records).getByText(/Week 30, 2026/)).toBeInTheDocument()
    expect(within(records).getByText('0.62%')).toBeInTheDocument()
  })

  it('edits the nickname in place', async () => {
    mockMutations()
    vi.mocked(useAccount).mockReturnValue(signedIn())
    const user = userEvent.setup()
    render(<ProfilePage />)

    await user.click(screen.getByRole('button', { name: 'Edit nickname' }))
    expect(screen.getByLabelText('Nickname')).toHaveValue('Ada')
    await user.click(screen.getByRole('button', { name: 'Save nickname' }))

    expect(screen.queryByLabelText('Nickname')).not.toBeInTheDocument()
  })

  it('signs out and deletes the account after confirmation', async () => {
    const { signOut, deleteAccount } = mockMutations()
    vi.mocked(useAccount).mockReturnValue(signedIn({ me: { ...ME, badges: [], records: [] } }))
    const user = userEvent.setup()
    render(<ProfilePage />)

    expect(screen.getByText(/finish a ranked run to set your first record/i)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Sign out' }))
    expect(signOut.mutate).toHaveBeenCalledOnce()

    await user.click(screen.getByRole('button', { name: 'Delete account…' }))
    expect(screen.getByRole('alert')).toHaveTextContent(/can’t be undone/i)
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Delete account…' }))
    await user.click(screen.getByRole('button', { name: 'Delete forever' }))
    expect(deleteAccount.mutate).toHaveBeenCalledOnce()
  })
})
