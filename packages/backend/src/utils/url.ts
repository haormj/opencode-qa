export function normalizeServerUrl(url: string): string {
  return url.trim().replace(/\/+$/, '')
}
