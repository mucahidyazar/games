/**
 * Tiny logger. Warnings are development-only noise; errors are always
 * reported because they point at real bugs (swap `error` for a monitoring
 * service such as Sentry when one is added).
 */
export const logger = {
  warn(message: string, detail?: unknown): void {
    if (import.meta.env.DEV) console.warn(`[TrapTheOrb] ${message}`, detail ?? '')
  },
  error(message: string, detail?: unknown): void {
    console.error(`[TrapTheOrb] ${message}`, detail ?? '')
  },
}
