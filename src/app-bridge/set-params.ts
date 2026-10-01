/**
 * Host → bridge param seeding.
 *
 * Part of the `$app/*` Adapter bridge (see page-state.ts header for the
 * module id map). After build rewrite, Upstream reads these values via
 * `$app/state` / `$app/stores`.
 */

import { applyWorkflowRouteParams } from './page-state.js';

export type WorkflowRouteParams = {
  namespace: string;
  /** Temporal workflow id (Upstream route param `workflow`). */
  workflow: string;
  /** Temporal run id (Upstream route param `run`). */
  run: string;
};

/**
 * Update bridged `page.params` and sync `page.url` pathname to a
 * Temporal-shaped history path. Preserves existing search/query.
 */
export function setWorkflowRouteParams(input: WorkflowRouteParams): void {
  applyWorkflowRouteParams(input);
}
