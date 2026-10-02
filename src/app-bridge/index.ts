/**
 * Public Adapter `$app/*` param bridge API.
 *
 * Module id map (post-rewrite):
 * - `$app/state` → page-state.ts
 * - `$app/paths` → paths.ts
 * - `$app/navigation` → navigation.ts
 * - `$app/stores` → stores.ts
 *
 * Hosts seed route params via {@link setWorkflowRouteParams} (called from
 * `WorkflowHistory`); they do not need Temporal-shaped Kit route params.
 */

export {
  setWorkflowRouteParams,
  type WorkflowRouteParams,
} from './set-params.js';

export {
  page,
  type BridgedPage,
  type BridgedPageParams,
} from './page-state.js';

// Keep rewrite targets on the package keep-set (graph would otherwise drop them
// because Upstream `$app/*` imports are external until rewrite-app-bridge runs).
export { base, assets, resolve } from './paths.js';
export {
  goto,
  invalidate,
  invalidateAll,
  beforeNavigate,
  afterNavigate,
} from './navigation.js';
export { page as pageStore, navigating, updated, getStores } from './stores.js';
