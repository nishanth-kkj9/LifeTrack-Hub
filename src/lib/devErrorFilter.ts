/**
 * DEV-ONLY console noise filter.
 *
 * Previously, an inline <script> in index.html silenced ANY window error containing
 * "WebSocket" or "unauthorized-domain" — in production too, masking real failures.
 * This module restores the AI Studio preview convenience but is imported ONLY when
 * Vite builds in dev mode (the branch is tree-shaken out of production bundles).
 */
export function installDevErrorFilter(): void {
  const isNoise = (msg: string) =>
    msg.includes('WebSocket') ||
    msg.includes('createWebSocketModuleRunnerTransport') ||
    msg.includes('unauthorized-domain');

  window.addEventListener(
    'error',
    (e) => {
      if (e?.message && isNoise(String(e.message))) {
        e.stopImmediatePropagation();
        e.preventDefault();
      }
    },
    true
  );

  window.addEventListener(
    'unhandledrejection',
    (e) => {
      const reason = (e?.reason?.message || String(e?.reason ?? '')) as string;
      if (isNoise(reason)) {
        e.stopImmediatePropagation();
        e.preventDefault();
      }
    },
    true
  );
}
