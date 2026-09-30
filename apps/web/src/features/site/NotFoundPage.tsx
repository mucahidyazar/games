import { Link } from '@/app/Link'
import { paths, site } from '@/app/site'
import { seoFor } from '@/sites/seo'

/** In-app 404 for unknown paths (the static 404.html covers hosts that serve it directly). */
export function NotFoundPage() {
  const copy = seoFor(site).notFound
  return (
    <section aria-labelledby="not-found-title" className="mx-auto max-w-[520px] py-16 text-center">
      <p className="text-[0.72rem] font-bold tracking-[0.14em] text-teal-700 uppercase">Error 404 · Page not found</p>
      <h1 id="not-found-title" className="mt-2 text-[1.8rem] font-extrabold tracking-[-0.03em]">
        {copy.headline}
      </h1>
      <p className="mt-2 text-[0.92rem] text-muted">{copy.body}</p>
      <Link
        href={paths.home()}
        className="mt-6 inline-flex h-11 items-center rounded-(--radius-control) bg-coral-600 px-6 font-bold text-white shadow-coral transition hover:bg-coral-700"
      >
        {copy.cta}
      </Link>
    </section>
  )
}
