import { BulbIcon } from '@/components/icons'
import { tipForLevel } from '../content/tips'

type TipCardProps = {
  readonly level: number
}

export function TipCard({ level }: TipCardProps) {
  return (
    <section aria-labelledby="tip-title" className="card flex gap-3 px-4 py-3.5">
      <BulbIcon className="mt-px size-[18px] shrink-0 text-teal-500" />
      <div>
        <h2 id="tip-title" className="text-[0.88rem] font-bold">
          Tip
        </h2>
        <p key={level} className="mt-1 animate-rise text-[0.82rem] leading-[1.5] text-muted">
          {tipForLevel(level)}
        </p>
      </div>
    </section>
  )
}
