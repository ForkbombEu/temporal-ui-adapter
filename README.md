# @forkbombeu/temporal-ui

Host-facing Adapter around [temporalio/ui](https://github.com/temporalio/ui) workflow history. Upstream lives in `upstream/` (submodule); this repo only authors the Adapter.

See [CONTEXT.md](./CONTEXT.md) for vocabulary and [docs/adr/](./docs/adr/) for decisions.

## Install (Host)

Download the Release `.tgz` for version `2.54.1-fb.n` (no registry auth):

```sh
pnpm add ./forkbombeu-temporal-ui-2.54.1-fb.0.tgz
```

## Usage

```svelte
<script>
  import { WorkflowHistory, WorkflowStatus } from '@forkbombeu/temporal-ui';
</script>

<WorkflowStatus status={executionStatus} />

<div class="temporal-ui-host">
  <WorkflowHistory
    {execution}
    {history}
    namespace={orgSlug}
    workers={optionalTaskQueue}
  />
</div>
```

- Pass **raw** Temporal API get-execution body and history events; the Adapter converts.
- CSS is imported by the components (scoped under `.temporal-ui`). Do not copy into `static/`.
- Read-only: Host owns cancel/terminate. Internal Temporal links are disabled via CSS.
- Zero-patch constraint: the Host **page** must still expose SvelteKit params named `namespace`, `workflow`, and `run` (values can match the props). Upstream builds `href`s with `resolve()` during render; missing `namespace` throws even when clicks are disabled.

## Develop

Exploration branch (`explore/derived-deps-kit-root`): root deps are derived from
Upstream. Install at the **repo root** (not inside `upstream/`). There is no root
app page — the Host demo is `examples/consumer`.

```sh
git submodule update --init --recursive
node scripts/sync-from-upstream.mjs   # rewrite package.json from upstream/package.json
pnpm install                          # root toolchain + Upstream runtime deps
pnpm exec svelte-kit sync             # also runs via prepare
pnpm build                            # → package/ + uses root node_modules
```

Adapter `src/` imports Upstream via `$lib/…`. Root Kit aliases those paths into
`upstream/`. The build stages under `.build/stage/` using `packaging/stage.*` (never
writes into `upstream/`). Re-run `sync:upstream` after bumping the submodule pin.

```sh
cp package/forkbombeu-temporal-ui-*.tgz examples/consumer/temporal-ui.tgz
cd examples/consumer && pnpm install --ignore-workspace && pnpm add --ignore-workspace ./temporal-ui.tgz
pnpm run build && pnpm exec vite preview --port 5199 --strictPort
```

Requires Node ≥ 22.14 and pnpm ≥ 10.10.
