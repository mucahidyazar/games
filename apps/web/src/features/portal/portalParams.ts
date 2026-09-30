import { isCategoryId, type CategoryId } from '@/sites/games'

export type CategoryFilter = CategoryId | 'all'

/** The category picked on the home page, kept in the URL (`?category=puzzle`). */
export function parseCategoryFilter(search: string): CategoryFilter {
  const value = new URLSearchParams(search).get('category')
  return isCategoryId(value) ? value : 'all'
}

/** The home page filtered to a category; no hash, so switching chips never scrolls the page. */
export function categoryHref(filter: CategoryFilter): string {
  return filter === 'all' ? '/' : `/?category=${filter}`
}
