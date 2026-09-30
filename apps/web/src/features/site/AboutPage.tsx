import { Link } from '@/app/Link'
import { paths, site } from '@/app/site'
import { ArrowLeftIcon } from '@/components/icons'
import { AboutContent } from './content/AboutContent'

export function AboutPage() {
  return (
    <section aria-labelledby="about-title" className="mx-auto max-w-[760px] py-6 sm:py-10">
      <Link href={paths.home()} className="inline-flex min-h-10 items-center gap-2 rounded text-sm font-semibold text-teal-700 hover:underline"><ArrowLeftIcon className="size-4" />{site.kind === 'portal' ? 'All games' : 'Back to the game'}</Link>
      <p className="mt-6 text-xs font-bold tracking-[0.16em] text-teal-700 uppercase">Behind the games</p>
      <h1 id="about-title" className="mt-3 break-words text-3xl font-extrabold tracking-tight sm:text-4xl">About {site.name}</h1>
      <p className="mt-4 text-lg leading-relaxed text-muted">Made for a quick break. Built with care.</p>
      <div className="prose-dialog mt-8 rounded-2xl border border-line bg-surface p-6 sm:p-8"><AboutContent /></div>
    </section>
  )
}
