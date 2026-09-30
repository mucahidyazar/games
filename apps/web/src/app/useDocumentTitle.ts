import { useEffect } from 'react'
import { siteConfig } from '@/lib/site'
import type { Route } from '@/sites/routes'
import { pageSeoFor, seoFor } from '@/sites/seo'
import type { Site } from '@/sites/sites'
import { site as currentSite } from './site'

export function titleFor(route: Route, site: Site): string {
  return pageSeoFor(route, site).title
}

function meta(attribute: 'name' | 'property', key: string, content: string): void {
  let element = document.head.querySelector<HTMLMetaElement>(`meta[${attribute}="${key}"]`)
  if (!element) {
    element = document.createElement('meta')
    element.setAttribute(attribute, key)
    document.head.append(element)
  }
  element.content = content
}

function link(rel: string, href: string): void {
  let element = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`)
  if (!element) {
    element = document.createElement('link')
    element.rel = rel
    document.head.append(element)
  }
  element.href = href
}

/** Also refresh canonical/share metadata when navigating without reloading the app. */
export function updateDocumentMetadata(route: Route, site: Site, siteUrl: string): void {
  const seo = seoFor(site)
  const page = pageSeoFor(route, site, siteUrl)
  document.title = page.title
  meta('name', 'description', page.description)
  meta('name', 'robots', page.robots)
  // Keep browser chrome in lockstep with the active site theme. This is also
  // updated by the theme store when the user toggles between Navy and Light.
  meta('name', 'theme-color', document.documentElement.dataset.theme === 'light' ? '#f9fafc' : '#0b1630')
  meta('name', 'apple-mobile-web-app-title', site.name)
  meta('property', 'og:site_name', site.name)
  meta('property', 'og:url', page.canonical)
  for (const [key, content] of Object.entries({ title: page.title, description: page.description, image: page.image, 'image:alt': page.imageAlt })) {
    meta('property', `og:${key}`, content)
    meta('name', `twitter:${key}`, content)
  }
  link('canonical', page.canonical)
  link('icon', seo.favicon)
  link('apple-touch-icon', seo.appleTouchIcon)
  link('manifest', seo.manifest)
  let jsonLd = document.head.querySelector<HTMLScriptElement>('script[type="application/ld+json"]')
  if (!jsonLd) {
    jsonLd = document.createElement('script')
    jsonLd.type = 'application/ld+json'
    document.head.append(jsonLd)
  }
  jsonLd.textContent = JSON.stringify(page.jsonLd)
}

export function useDocumentTitle(route: Route): void {
  useEffect(() => {
    updateDocumentMetadata(route, currentSite, siteConfig.url)
  }, [route])
}
