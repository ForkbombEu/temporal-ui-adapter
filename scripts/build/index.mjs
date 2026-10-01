/**
 * Canonical Adapter package build.
 *
 * Build @forkbombeu/temporal-ui from pristine Upstream + Adapter `src/`.
 * Upstream is never mutated: staging happens under `.build/stage/`.
 *
 * Flow: stage (Upstream lib + Adapter as forkbomb) → svelte-package → prune import
 * graph → scoped/split Tailwind CSS → optional @buf vendoring → trim deps → package.json.
 *
 * IDE and stage share the same mental model: Adapter imports `$lib/…` which means
 * Upstream `src/lib` (root Kit config aliases into `upstream/` for edit-time;
 * stage uses `packaging/stage.*` with `$lib` → staged lib). Toolchain bins and
 * `node_modules` come from the **root** install (`pnpm sync:upstream` then
 * `pnpm install`), not from `upstream/node_modules`.
 *
 * CSS split: two Tailwind builds with different `content` arrays. Status content =
 * Rollup graph from `forkbomb/workflow-status.svelte` (badge-only). History content =
 * graph from `forkbomb/workflow-history.svelte` (history view). Package keep-set is
 * the union with `forkbomb/index.js`.
 *
 * Both compiles use `important: '.temporal-ui'`. Tailwind `important` only scopes
 * utilities — a post-process rewrites bare `:root` / `html` / `body` / `h1–h6`
 * onto `.temporal-ui` so preflight/base do not leak into the Host.
 *
 * CSS lands at `dist/forkbomb/workflow-{status,history}.css` next to the adapter
 * components that `import './workflow-*.css'`.
 *
 * @buf/*: if present on the runtime graph, vendor into `dist/vendor` and rewrite
 * imports so Hosts need no Buf `.npmrc`; otherwise leave as dependencies + TODO.
 */
import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { contentFiles, compileScopedCss } from './css.mjs';
import { rmrf } from './fs.mjs';
import { fixDateFnsTzInterop } from './fix-date-fns-tz.mjs';
import { collectGraph, expandDeclarationGraph } from './graph.mjs';
import { acquireBuildLock } from './lock.mjs';
import {
  assertBuildPrereqs,
  bin,
  buildDir,
  dist,
  fullDist,
  pkgDir,
  stageDir,
} from './paths.mjs';
import { rewriteAppBridgeImports } from './rewrite-app-bridge.mjs';
import { prepareStage } from './stage.mjs';
import { writePackageJson } from './write-package-json.mjs';

assertBuildPrereqs();
acquireBuildLock();

// ── 1. Stage Adapter + Upstream lib (Upstream tree stays pristine) ─────────
prepareStage();
const stagePkgOut = join(buildDir, 'stage-package');
rmrf(stagePkgOut);
rmrf(fullDist);
execFileSync(bin('svelte-package'), ['-i', 'src/lib', '-o', stagePkgOut, '--tsconfig', 'tsconfig.json'], {
  cwd: stageDir,
  stdio: 'inherit',
});
mkdirSync(dirname(fullDist), { recursive: true });
cpSync(stagePkgOut, fullDist, { recursive: true });
rmrf(stagePkgOut);

// ── 2. Runtime graphs (status vs history for CSS; union for package keep) ──
const statusGraph = await collectGraph('forkbomb/workflow-status.svelte');
const historyGraph = await collectGraph('forkbomb/workflow-history.svelte');
const indexGraph = await collectGraph('forkbomb/index.js');

const runtimeFiles = new Set([
  ...statusGraph.runtimeFiles,
  ...historyGraph.runtimeFiles,
  ...indexGraph.runtimeFiles,
]);
const runtimeImports = new Set([
  ...statusGraph.runtimeImports,
  ...historyGraph.runtimeImports,
  ...indexGraph.runtimeImports,
]);

// ── 3. Declaration graph ───────────────────────────────────────────────────
const { keep, typeImports } = expandDeclarationGraph(runtimeFiles);

// ── 4. Copy kept files into publishable package ────────────────────────────
rmrf(pkgDir);
for (const file of keep) {
  const target = join(dist, relative(fullDist, file));
  mkdirSync(dirname(target), { recursive: true });
  cpSync(file, target);
}
fixDateFnsTzInterop(dist);
// Rewrite Upstream `$app/{state,paths,navigation,stores}` → forkbomb/app-bridge/*
rewriteAppBridgeImports(dist);

// ── 5. Scoped + split CSS (overwrite stub sheets next to components) ───────
compileScopedCss(
  contentFiles(statusGraph.runtimeFiles),
  join(dist, 'forkbomb/workflow-status.css'),
  'status',
);
compileScopedCss(
  contentFiles(historyGraph.runtimeFiles),
  join(dist, 'forkbomb/workflow-history.css'),
  'history',
);

// ── 6. package.json (lean exports; CSS via component imports) ──────────────
writePackageJson({
  runtimeImports,
  typeImports,
  keep,
  runtimeFiles,
  statusCssModules: statusGraph.runtimeFiles.size,
  historyCssModules: historyGraph.runtimeFiles.size,
});
