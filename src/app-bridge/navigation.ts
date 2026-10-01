/**
 * Adapter bridge for `$app/navigation` (build rewrite target).
 *
 * Module id map (post-rewrite):
 * - `$app/state` → page-state.ts
 * - `$app/paths` → paths.ts
 * - `$app/navigation` → navigation.ts (this file)
 * - `$app/stores` → stores.ts
 *
 * `goto` mutates the bridged page URL only — no `window.history` / Kit router.
 */

import { applyBridgedPageUrl } from './page-state.js';

export type GotoOptions = {
  replaceState?: boolean;
  noscroll?: boolean;
  noScroll?: boolean;
  keepfocus?: boolean;
  keepFocus?: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  state?: any;
  invalidateAll?: boolean;
};

export function disableScrollHandling(): void {
  /* no-op in Adapter embed */
}

/**
 * Update bridged `page.url` (and params when the path is Temporal-shaped).
 * Does not touch Host history or perform real navigation.
 */
export async function goto(
  url: string | URL,
  _opts?: GotoOptions,
): Promise<void> {
  applyBridgedPageUrl(url);
}

export async function invalidate(
  _dependency: string | ((href: string) => boolean),
): Promise<void> {
  /* no-op — Adapter has no Kit load graph */
}

export async function invalidateAll(): Promise<void> {
  /* no-op */
}

export async function prefetch(_href: string): Promise<void> {
  /* no-op */
}

export async function prefetchRoutes(_routes?: string[]): Promise<void> {
  /* no-op */
}

export function beforeNavigate(
  _fn: (navigation: {
    from: URL;
    to: URL | null;
    cancel: () => void;
  }) => void,
): void {
  /* no-op — filter layouts register cleanup hooks we ignore */
}

export function afterNavigate(
  _fn: (navigation: { from: URL | null; to: URL }) => void,
): void {
  /* no-op */
}
