/**
 * Validation for the backend URL accepted by the privileged desktop window.
 * @module @deepseek-ai/dsh-desktop/backend-url
 */

const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '[::1]'])

/**
 * Validate the developer-provided backend URL before the privileged desktop window loads it.
 * @param value - Candidate backend URL.
 * @returns A normalized loopback HTTP URL.
 */
export function normalizeBackendUrl(value: string): string {
  const url = new URL(value)
  if (!['http:', 'https:'].includes(url.protocol) || !LOOPBACK_HOSTS.has(url.hostname)) {
    throw new Error('DSH_DESKTOP_SERVER_URL must use HTTP on a loopback host')
  }
  if (url.username !== '' || url.password !== '') {
    throw new Error('DSH_DESKTOP_SERVER_URL must not include credentials')
  }
  return url.toString()
}
