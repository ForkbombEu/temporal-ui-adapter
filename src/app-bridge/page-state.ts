/**
 * Adapter bridge for `$app/state` (build rewrite target).
 *
 * Module id map (post-rewrite):
 * - `$app/state` → page-state.ts (this file)
 * - `$app/paths` → paths.ts
 * - `$app/navigation` → navigation.ts
 * - `$app/stores` → stores.ts
 *
 * IMPORTANT: `page` is a plain object, not `$state`. Upstream layouts `$effect`
 * over `page.url` / `page.params`; a Svelte `$state` proxy + our `goto` (which
 * replaces `url`) caused an infinite invalidation storm and wedged `/demo`.
 * Params are seeded from `WorkflowHistory` in `$effect.pre` before children
 * mount, so first `$derived(page.params…)` reads see the Host values.
 */

export type BridgedPageParams = {
  namespace: string;
  workflow: string;
  run: string;
  [key: string]: string | undefined;
};

export type BridgedPage = {
  params: BridgedPageParams;
  url: URL;
  data: Record<string, unknown>;
  route: { id: string | null };
  status: number;
  error: Error | null;
  state: Record<string, unknown>;
  form: unknown;
};

const BRIDGE_ORIGIN = 'http://temporal-ui.local';

const WORKFLOW_HISTORY_ROUTE_ID =
  '/namespaces/[namespace]/workflows/[workflow]/[run]';

const TEMPORAL_HISTORY_PATH =
  /^\/namespaces\/([^/]+)\/workflows\/([^/]+)\/([^/]+)\/?$/;

export function workflowHistoryPathname(
  params: Pick<BridgedPageParams, 'namespace' | 'workflow' | 'run'>,
): string {
  return `/namespaces/${encodeURIComponent(params.namespace)}/workflows/${encodeURIComponent(params.workflow)}/${encodeURIComponent(params.run)}`;
}

function createBridgedUrl(params: BridgedPageParams, search = ''): URL {
  const searchPart =
    search && !search.startsWith('?') ? `?${search}` : search;
  return new URL(
    `${BRIDGE_ORIGIN}${workflowHistoryPathname(params)}${searchPart}`,
  );
}

/** Mutable bridged Kit `page` — Hosts seed via `setWorkflowRouteParams`. */
export const page: BridgedPage = {
  params: {
    namespace: '',
    workflow: '',
    run: '',
  },
  url: new URL(`${BRIDGE_ORIGIN}/`),
  data: {},
  route: { id: WORKFLOW_HISTORY_ROUTE_ID },
  status: 200,
  error: null,
  state: {},
  form: null,
};

type PageListener = () => void;
const pageListeners = new Set<PageListener>();

/** Store subscribers (`$app/stores`) listen here when bridged page changes. */
export function subscribeToBridgedPage(listener: PageListener): () => void {
  pageListeners.add(listener);
  return () => {
    pageListeners.delete(listener);
  };
}

function notifyPageListeners(): void {
  for (const listener of pageListeners) listener();
}

function syncParamsFromPathname(pathname: string): void {
  const match = pathname.match(TEMPORAL_HISTORY_PATH);
  if (!match) return;
  page.params.namespace = decodeURIComponent(match[1] ?? '');
  page.params.workflow = decodeURIComponent(match[2] ?? '');
  page.params.run = decodeURIComponent(match[3] ?? '');
}

/** Seed / update route params from Host props; preserves current search. */
export function applyWorkflowRouteParams(input: {
  namespace: string;
  workflow: string;
  run: string;
}): void {
  const same =
    page.params.namespace === input.namespace &&
    page.params.workflow === input.workflow &&
    page.params.run === input.run;
  if (same) return;

  page.params.namespace = input.namespace;
  page.params.workflow = input.workflow;
  page.params.run = input.run;
  page.route = { id: WORKFLOW_HISTORY_ROUTE_ID };
  page.url = createBridgedUrl(page.params, page.url.search);
  notifyPageListeners();
}

/** Apply a navigation target to the bridged `page.url` only (no history API). */
export function applyBridgedPageUrl(url: string | URL): void {
  const next =
    typeof url === 'string' ? new URL(url, page.url) : new URL(url.href);
  if (next.href === page.url.href) return;
  page.url = next;
  syncParamsFromPathname(next.pathname);
  notifyPageListeners();
}
