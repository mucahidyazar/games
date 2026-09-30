import { nicknameSchema } from '@games/contract'
import { useId, useState, type FormEvent } from 'react'
import { ApiError } from '@/lib/api/client'
import { INPUT_CLASS, PRIMARY_BUTTON_CLASS } from './formStyles'
import { useUpdateNickname } from './queries'

type NicknameFormProps = {
  readonly initialValue: string
  readonly submitLabel: string
  readonly onSaved?: (nickname: string) => void
}

const RULES = '3–16 letters or numbers; spaces, dots, dashes and underscores are fine too.'

function saveErrorText(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 409) return 'That nickname is taken — try another one.'
    if (error.code === 'nickname_not_allowed') return 'That nickname isn’t allowed — please pick another one.'
    if (error.status === 400 || error.status === 422) return `That nickname isn’t allowed. ${RULES}`
    if (error.code === 'network') return 'The server can’t be reached. Please try again.'
  }
  return 'Your nickname couldn’t be saved. Please try again.'
}

/** Picks or changes the public nickname shown on the leaderboards. */
export function NicknameForm({ initialValue, submitLabel, onSaved }: NicknameFormProps) {
  const inputId = useId()
  const hintId = useId()
  const [value, setValue] = useState(initialValue)
  const [error, setError] = useState<string | null>(null)
  const update = useUpdateNickname()

  const handleSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault()
    const parsed = nicknameSchema.safeParse(value)
    if (!parsed.success) {
      setError(RULES)
      return
    }
    setError(null)
    try {
      const saved = await update.mutateAsync(parsed.data)
      onSaved?.(saved.nickname)
    } catch (caught: unknown) {
      setError(saveErrorText(caught))
    }
  }

  return (
    <form onSubmit={(event) => void handleSubmit(event)} noValidate>
      <label htmlFor={inputId} className="block text-[0.8rem] font-semibold text-ink">
        Nickname
      </label>
      <input
        id={inputId}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        maxLength={16}
        autoComplete="nickname"
        aria-describedby={hintId}
        aria-invalid={error !== null || undefined}
        className={`${INPUT_CLASS} mt-1.5`}
      />
      <p id={hintId} className={`mt-1.5 text-[0.76rem] ${error ? 'text-danger' : 'text-subtle'}`}>
        {error ?? RULES}
      </p>
      <button type="submit" disabled={update.isPending} className={`${PRIMARY_BUTTON_CLASS} mt-3`}>
        {update.isPending ? 'Saving…' : submitLabel}
      </button>
    </form>
  )
}
