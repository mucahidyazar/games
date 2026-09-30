import { Link } from '@/app/Link'
import { footerColumnsFor, type NavItem } from '@/app/navigation'
import { paths, site } from '@/app/site'
import { ArrowUpRightIcon } from '@/components/icons'
import { siteConfig } from '@/lib/site'
import type { Route } from '@/sites/routes'
import { PORTAL } from '@/sites/sites'
import { Brand } from './Brand'

type SiteFooterProps = {
  readonly route: Route
}

const TAGLINES = {
  portal: 'Small, sharp games that run right in your browser. No download, no sign-up needed.',
  game: 'Trap the orbs. Claim the space. A free arcade game for your browser — no download, no sign-up needed.',
} as const

function FooterLink({ item }: { readonly item: NavItem }) {
  const external = item.isExternal ? { target: '_blank', rel: 'noopener noreferrer' } : {}
  return (
    <Link
      href={item.href}
      className="inline-flex items-center gap-1.5 rounded text-[0.84rem] text-[var(--chrome-muted)] underline-offset-4 transition hover:text-[var(--chrome-fg)] hover:underline"
      {...external}
    >
      {item.label}
      {item.badge && (
        <span className="rounded-full bg-coral-400/25 px-1.5 py-px text-[0.56rem] font-bold tracking-wide text-coral-200 uppercase">
          {item.badge}
        </span>
      )}
      {item.isExternal && <ArrowUpRightIcon className="size-3.5 opacity-60" />}
    </Link>
  )
}

/** The maker's signature under the footer, on every site. */
function MadeWith() {
  const portalHref = site.kind === 'portal' ? paths.home() : PORTAL.url
  return (
    <p className="flex flex-wrap items-center justify-center gap-x-1.5 text-[0.8rem] text-[var(--chrome-muted)]">
      Made with
      <span role="img" aria-label="love">💜</span>
      by
      <a
        href="https://mucahid.dev"
        target="_blank"
        rel="noopener noreferrer"
        className="rounded font-semibold text-[var(--chrome-fg)] underline-offset-4 transition hover:opacity-75 hover:underline"
      >
        mucahid.dev
      </a>
      for
      <Link href={portalHref} className="rounded font-semibold text-[var(--chrome-fg)] underline-offset-4 transition hover:opacity-75 hover:underline">
        games.mucahid.dev
      </Link>
    </p>
  )
}

/** Dark footer matching the header; the layout keeps it at the bottom of short pages. */
export function SiteFooter({ route }: SiteFooterProps) {
  const columns = footerColumnsFor(site, route, paths)

  return (
    <footer className="mt-auto shrink-0 border-t border-[var(--chrome-border)] bg-[var(--chrome-bg)] text-[var(--chrome-fg)]">
      <div className="mx-auto max-w-[1440px] px-4 pt-10 pb-8 sm:px-6 lg:px-8">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1fr)]">
          <div className="sm:col-span-2 lg:col-span-1">
            <Link href={paths.home()} className="inline-block rounded-lg">
              <Brand size="footer" />
            </Link>
            <p className="mt-3 max-w-[40ch] text-[0.84rem] leading-relaxed text-[var(--chrome-muted)]">{TAGLINES[site.kind]}</p>
            <p className="mt-4 text-[0.76rem] text-[var(--chrome-muted)]">
              © {new Date().getFullYear()} {site.name}
              {siteConfig.contactEmail && (
                <>
                  {' · '}
                  <a href={`mailto:${siteConfig.contactEmail}`} className="rounded underline-offset-4 hover:opacity-75 hover:underline">
                    {siteConfig.contactEmail}
                  </a>
                </>
              )}
            </p>
          </div>
          {columns.map((column) => (
            <nav key={column.title} aria-label={`${column.title} links`}>
              <h2 className="text-[0.66rem] font-bold tracking-[0.16em] text-[var(--chrome-muted)] uppercase">{column.title}</h2>
              <ul className="mt-3 grid gap-2">
                {column.links.map((link) => (
                  <li key={link.href}>
                    <FooterLink item={link} />
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
      </div>
      <div className="border-t border-[var(--chrome-border)]">
        <div className="mx-auto max-w-[1440px] px-4 py-4 sm:px-6 lg:px-8">
          <MadeWith />
        </div>
      </div>
    </footer>
  )
}
