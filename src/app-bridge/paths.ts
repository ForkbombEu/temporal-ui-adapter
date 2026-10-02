/**
 * Adapter bridge for `$app/paths` (build rewrite target).
 *
 * Module id map (post-rewrite):
 * - `$app/state` → page-state.ts
 * - `$app/paths` → paths.ts (this file)
 * - `$app/navigation` → navigation.ts
 * - `$app/stores` → stores.ts
 *
 * Mirrors Upstream `svelte-mocks/app/paths.ts` resolve semantics
 * (string-replace `[param]` segments).
 */

/** Kit `paths.base` stub — empty for Host-embedded Adapter. */
export const base = '';

/** Kit `paths.assets` stub. */
export const assets = '';

/**
 * Resolve a route id / pathname, substituting `[param]` segments.
 * Prefixed with {@link base} when set.
 */
export function resolve(
  route: string,
  params?: Record<string, string>,
): string {
  let resolved = route;
  if (params) {
    resolved = Object.entries(params).reduce(
      (path, [key, value]) => path.replace(`[${key}]`, value),
      resolved,
    );
  }
  return `${base}${resolved}`;
}
