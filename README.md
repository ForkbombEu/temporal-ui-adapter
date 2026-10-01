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

Tooling is pinned in `.tool-versions` (Node 22.18 / pnpm 10.15). With [mise](https://mise.jdx.dev/):

```sh
mise install          # once per machine / after pin bumps
# ensure shell hook: eval "$(mise activate zsh)"  # or bash/fish
pnpm -v               # should be ≥10.10 (mise pin is 10.15)
```

If `pnpm -v` still shows 9.x, a global install (e.g. `~/Library/pnpm`) is shadowing mise — prefer:

```sh
mise which pnpm       # …/mise/installs/pnpm/10.15.0/pnpm
hash -r && "$(mise which pnpm)" -v
# or: mise exec -- $(mise which pnpm) build
```

Then:

```sh
git submodule update --init --recursive
pnpm sync:upstream                    # package.json + shared Upstream pins (see docs/upstream-dotfiles.md)
pnpm install                          # root toolchain + Upstream runtime deps
pnpm exec svelte-kit sync             # also runs via prepare
pnpm build                            # → package/ + uses root node_modules
pnpm dev                              # build Package, then examples/consumer on :5199
```

Adapter `src/` imports Upstream via `$lib/…`. Root Kit aliases those paths into
`upstream/`. The build stages under `.build/stage/` using `packaging/stage.*` (never
writes into `upstream/`). Re-run `sync:upstream` after bumping the submodule pin.

```sh
# from repo root (after pnpm build → package/)
cd examples/consumer && pnpm install
pnpm run build && pnpm exec vite preview --port 5199 --strictPort
# or: pnpm dev  (clears Vite dep cache so file:../../package updates show up)
```

Consumer (`examples/consumer`) is the Host smoke app (`@sveltejs/adapter-auto`, Tailwind 4)
and depends on `file:../../package`. If install fails with ENOENT on that path, run
`pnpm build` at the repo root first. After rebuilding the Adapter, restart `pnpm dev`
(it wipes `node_modules/.vite`) so you are not stuck on a stale prebundle.

Requires Node ≥ 22.14 and pnpm ≥ 10.10.
