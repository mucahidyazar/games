import { emailOTPClient } from 'better-auth/client/plugins'
import { createAuthClient } from 'better-auth/react'

/**
 * Better Auth client. The API is same-origin (Vite proxies /api in
 * development), so the default base path /api/auth is used.
 */
export const authClient = createAuthClient({
  plugins: [emailOTPClient()],
  fetchOptions: {
    // Look fetch up on every request (Better Auth would keep the one present at start-up), so tests can stub it.
    customFetchImpl: (input, init) => globalThis.fetch(input, init),
  },
})

export type AuthSession = NonNullable<ReturnType<typeof authClient.useSession>['data']>
