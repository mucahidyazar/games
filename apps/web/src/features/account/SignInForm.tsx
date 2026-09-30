import { useEffect, useId, useState, type FormEvent } from 'react'
import { GoogleIcon, MailIcon } from '@/components/icons'
import { authClient } from './authClient'
import { INPUT_CLASS, LINK_BUTTON_CLASS, PRIMARY_BUTTON_CLASS, SECONDARY_BUTTON_CLASS } from './formStyles'
import { useAuthConfig } from './queries'

/** Seconds before another code can be requested. */
const RESEND_COOLDOWN_S = 30
const OTP_LENGTH = 6
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

type EmailStep = { readonly kind: 'email' } | { readonly kind: 'code'; readonly email: string }

interface AuthResult {
  readonly error?: { readonly message?: string; readonly status?: number } | null
}

function errorText(result: AuthResult, fallback: string): string | null {
  if (!result.error) return null
  if (result.error.status === 429) return 'Too many attempts. Please wait a minute and try again.'
  return result.error.message || fallback
}

/** Where to come back after Google: the same page, with this dialog open for the nickname step. */
function returnUrl(): string {
  return `${window.location.pathname}${window.location.search}#account`
}

function GoogleButton() {
  const [isBusy, setIsBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const signIn = async (): Promise<void> => {
    setIsBusy(true)
    setError(null)
    const result: AuthResult = await authClient.signIn.social({
      provider: 'google',
      callbackURL: returnUrl(),
      errorCallbackURL: returnUrl(),
    })
    // On success the browser is already on its way to Google.
    const message = errorText(result, 'Google sign-in is unavailable right now.')
    if (message) {
      setError(message)
      setIsBusy(false)
    }
  }

  return (
    <div>
      <button type="button" disabled={isBusy} onClick={() => void signIn()} className={SECONDARY_BUTTON_CLASS}>
        <GoogleIcon className="size-5" />
        {isBusy ? 'Opening Google…' : 'Continue with Google'}
      </button>
      {error && (
        <p role="alert" className="mt-2 text-[0.8rem] text-danger">
          {error}
        </p>
      )}
    </div>
  )
}

function EmailCodeForm() {
  const emailId = useId()
  const codeId = useId()
  const [step, setStep] = useState<EmailStep>({ kind: 'email' })
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [isBusy, setIsBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cooldown, setCooldown] = useState(0)

  useEffect(() => {
    if (cooldown <= 0) return
    const timer = window.setTimeout(() => setCooldown((seconds) => seconds - 1), 1000)
    return () => window.clearTimeout(timer)
  }, [cooldown])

  const sendCode = async (address: string): Promise<boolean> => {
    setIsBusy(true)
    setError(null)
    const result: AuthResult = await authClient.emailOtp.sendVerificationOtp({ email: address, type: 'sign-in' })
    setIsBusy(false)
    const message = errorText(result, 'We couldn’t send the code. Please try again.')
    if (message) {
      setError(message)
      return false
    }
    setCooldown(RESEND_COOLDOWN_S)
    return true
  }

  const handleEmail = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault()
    const address = email.trim().toLowerCase()
    if (!EMAIL_PATTERN.test(address)) {
      setError('Please enter a valid email address.')
      return
    }
    if (await sendCode(address)) {
      setCode('')
      setStep({ kind: 'code', email: address })
    }
  }

  const handleCode = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault()
    if (step.kind !== 'code') return
    const otp = code.replace(/\D/g, '')
    if (otp.length !== OTP_LENGTH) {
      setError(`Enter the ${OTP_LENGTH}-digit code from the email.`)
      return
    }
    setIsBusy(true)
    setError(null)
    const result: AuthResult = await authClient.signIn.emailOtp({ email: step.email, otp })
    setIsBusy(false)
    // On success the session updates and this dialog moves on by itself.
    setError(errorText(result, 'That code didn’t work. Check it or request a new one.'))
  }

  if (step.kind === 'code') {
    return (
      <form onSubmit={(event) => void handleCode(event)} noValidate>
        <p className="text-[0.84rem] text-muted">
          We sent a {OTP_LENGTH}-digit code to <strong className="font-semibold text-ink">{step.email}</strong>. It
          expires in a few minutes.
        </p>
        <label htmlFor={codeId} className="mt-3 block text-[0.8rem] font-semibold text-ink">
          Sign-in code
        </label>
        <input
          id={codeId}
          value={code}
          onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, OTP_LENGTH))}
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]*"
          maxLength={OTP_LENGTH}
          placeholder="123456"
          autoFocus
          className={`${INPUT_CLASS} mt-1.5 text-center text-[1.2rem] tracking-[0.4em]`}
        />
        {error && (
          <p role="alert" className="mt-2 text-[0.8rem] text-danger">
            {error}
          </p>
        )}
        <button type="submit" disabled={isBusy} className={`${PRIMARY_BUTTON_CLASS} mt-3`}>
          {isBusy ? 'Signing in…' : 'Sign in'}
        </button>
        <div className="mt-3 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => {
              setStep({ kind: 'email' })
              setError(null)
            }}
            className={LINK_BUTTON_CLASS}
          >
            Use a different email
          </button>
          <button
            type="button"
            disabled={isBusy || cooldown > 0}
            onClick={() => void sendCode(step.email)}
            className={LINK_BUTTON_CLASS}
          >
            {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code'}
          </button>
        </div>
      </form>
    )
  }

  return (
    <form onSubmit={(event) => void handleEmail(event)} noValidate>
      <label htmlFor={emailId} className="block text-[0.8rem] font-semibold text-ink">
        Email
      </label>
      <input
        id={emailId}
        type="email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        autoComplete="email"
        placeholder="you@example.com"
        className={`${INPUT_CLASS} mt-1.5`}
      />
      {error && (
        <p role="alert" className="mt-2 text-[0.8rem] text-danger">
          {error}
        </p>
      )}
      <button type="submit" disabled={isBusy} className={`${PRIMARY_BUTTON_CLASS} mt-3`}>
        <MailIcon className="size-[18px]" />
        {isBusy ? 'Sending…' : 'Email me a sign-in code'}
      </button>
    </form>
  )
}

/** Google and passwordless email sign-in, whichever the server has configured. */
export function SignInForm() {
  const config = useAuthConfig()
  const authError = new URLSearchParams(window.location.search).get('error')

  if (config.isPending) {
    return <div aria-label="Loading sign-in options" className="h-24 animate-pulse rounded-[12px] bg-sunken" />
  }
  if (config.isError || (!config.data.auth.google && !config.data.auth.email)) {
    return (
      <p className="rounded-[12px] bg-page px-4 py-4 text-center text-[0.86rem] text-muted">
        Accounts are unavailable right now. You can keep playing as a guest.
      </p>
    )
  }

  const { google, email } = config.data.auth
  return (
    <div className="space-y-4">
      {authError && (
        <p role="alert" className="rounded-[10px] bg-coral-400/10 px-3 py-2 text-[0.8rem] text-danger">
          Sign-in didn’t finish. Please try again.
        </p>
      )}
      {google && <GoogleButton />}
      {google && email && (
        <p className="flex items-center gap-3 text-[0.72rem] font-semibold tracking-[0.12em] text-subtle uppercase">
          <span aria-hidden="true" className="h-px flex-1 bg-divider" />
          or
          <span aria-hidden="true" className="h-px flex-1 bg-divider" />
        </p>
      )}
      {email && <EmailCodeForm />}
    </div>
  )
}
