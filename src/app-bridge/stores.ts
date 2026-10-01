/**
 * Adapter bridge for `$app/stores` (build rewrite target).
 *
 * Module id map (post-rewrite):
 * - `$app/state` → page-state.ts
 * - `$app/paths` → paths.ts
 * - `$app/navigation` → navigation.ts
 * - `$app/stores` → stores.ts (this file)
 *
 * Readable `$page` backed by the same bridged page as `$app/state`.
 */

import { readable } from 'svelte/store';

import {
  page as pageState,
  subscribeToBridgedPage,
  type BridgedPage,
} from './page-state.js';

function snapshotPage(): BridgedPage {
  return {
    params: pageState.params,
    url: pageState.url,
    data: pageState.data,
    route: pageState.route,
    status: pageState.status,
    error: pageState.error,
    state: pageState.state,
    form: pageState.form,
  };
}

export const page = readable<BridgedPage>(snapshotPage(), (set) => {
  set(snapshotPage());
  return subscribeToBridgedPage(() => {
    set(snapshotPage());
  });
});

export const navigating = readable(null);

export const updated = Object.assign(readable(false), {
  check: async (): Promise<boolean> => false,
});

export function getStores() {
  return { page, navigating, updated };
}
