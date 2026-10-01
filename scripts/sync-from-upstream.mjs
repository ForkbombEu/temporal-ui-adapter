/**
 * Derive root toolchain + shared pins from the pinned Upstream submodule.
 *
 * - Rewrites root `package.json` from `upstream/package.json`
 * - Copies as-is: `.npmrc`, `.node-version`, `.editorconfig`
 * - Adapts `.tool-versions`: `nodejs` from Upstream `.node-version`; keeps Adapter `pnpm`
 *
 * Policy SoT: docs/upstream-dotfiles.md
 * Upstream stays pristine — we only read it.
 *
 * Usage: node scripts/sync-from-upstream.mjs
 */
import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const upstreamDir = join(root, 'upstream');
const upstreamPkgPath = join(upstreamDir, 'package.json');
const outPath = join(root, 'package.json');

const PACKAGE_VERSION_SUFFIX = '-fb.0';
const DEFAULT_PNPM = '10.15.0';

/** DevDependencies needed to sync, package, and compile scoped CSS. */
const TOOLCHAIN_DEV_DEPS = [
  '@buf/temporalio_api.bufbuild_es',
  '@bufbuild/protobuf',
  '@sveltejs/adapter-static',
  '@sveltejs/kit',
  '@sveltejs/package',
  '@sveltejs/vite-plugin-svelte',
  '@types/node',
  'autoprefixer',
  'cssnano',
  'postcss',
  'postcss-load-config',
  'svelte',
  'svelte-check',
  'svelte-preprocess',
  'tailwindcss',
  'typescript',
  'vite',
];

/** Dotfiles copied byte-for-byte from Upstream → root. */
const COPY_AS_IS = ['.npmrc', '.node-version', '.editorconfig'];

if (!existsSync(upstreamPkgPath)) {
  console.error(
    `[sync-from-upstream] Missing ${relative(root, upstreamPkgPath)}. Init the submodule first.`,
  );
  process.exit(1);
}

const upstream = JSON.parse(readFileSync(upstreamPkgPath, 'utf8'));

const pick = (names, from) =>
  Object.fromEntries(
    names
      .filter((name) => name in from)
      .map((name) => [name, from[name]])
      .sort(([a], [b]) => a.localeCompare(b)),
  );

const missingToolchain = TOOLCHAIN_DEV_DEPS.filter(
  (name) => !(name in upstream.devDependencies) && !(name in upstream.dependencies),
);
if (missingToolchain.length) {
  console.warn(
    `[sync-from-upstream] Upstream missing toolchain pins (skipped): ${missingToolchain.join(', ')}`,
  );
}

const fromDev = pick(TOOLCHAIN_DEV_DEPS, upstream.devDependencies);
const fromDepsAsDev = pick(
  TOOLCHAIN_DEV_DEPS.filter((n) => !(n in fromDev)),
  upstream.dependencies,
);

const pkg = {
  name: '@forkbombeu/temporal-ui',
  version: `${upstream.version}${PACKAGE_VERSION_SUFFIX}`,
  private: true,
  type: 'module',
  description: 'Host-facing Adapter around temporalio/ui workflow history',
  scripts: {
    'sync:upstream': 'node scripts/sync-from-upstream.mjs',
    prepare: 'svelte-kit sync',
    build: 'node build.mjs',
    // Package-contract smoke via examples/consumer (file:../../package).
    dev: 'pnpm build && pnpm --dir examples/consumer install && pnpm --dir examples/consumer dev',
    pack: 'npm pack --pack-destination . --workdir package',
    check: 'svelte-check --tsconfig ./tsconfig.json',
  },
  engines: {
    node: upstream.engines?.node ?? '>=22.14',
    ...(upstream.engines?.pnpm ? { pnpm: upstream.engines.pnpm } : {}),
  },
  packageManager: upstream.packageManager ?? 'pnpm@10.10.0',
  // Full Upstream runtime graph — prune happens at package/ publish time.
  dependencies: Object.fromEntries(
    Object.entries(upstream.dependencies).sort(([a], [b]) => a.localeCompare(b)),
  ),
  devDependencies: {
    ...fromDev,
    ...fromDepsAsDev,
  },
  peerDependencies: {
    '@sveltejs/kit': upstream.peerDependencies['@sveltejs/kit'],
    svelte: upstream.peerDependencies.svelte,
  },
  pnpm: {
    overrides: upstream.pnpm?.overrides ?? {},
    onlyBuiltDependencies: [
      'esbuild',
      'svelte-preprocess',
      ...(upstream.pnpm?.onlyBuiltDependencies?.includes('protobufjs')
        ? ['protobufjs']
        : []),
    ],
  },
};

writeFileSync(outPath, `${JSON.stringify(pkg, null, 2)}\n`);

const copied = [];
const skipped = [];
for (const name of COPY_AS_IS) {
  const src = join(upstreamDir, name);
  const dest = join(root, name);
  if (!existsSync(src)) {
    skipped.push(name);
    console.warn(`[sync-from-upstream] Upstream missing ${name} (skipped copy)`);
    continue;
  }
  copyFileSync(src, dest);
  copied.push(name);
}

/** Parse `v22.18.0` / `22.18.0` → `22.18.0` for mise `.tool-versions`. */
function nodeVersionFromFile(contents) {
  const raw = contents.trim().split(/\s+/)[0] ?? '';
  return raw.replace(/^v/, '');
}

function readPnpmPin(toolVersionsPath) {
  if (!existsSync(toolVersionsPath)) return DEFAULT_PNPM;
  const match = readFileSync(toolVersionsPath, 'utf8').match(/^pnpm\s+(\S+)/m);
  return match?.[1] ?? DEFAULT_PNPM;
}

const nodeVersionPath = join(upstreamDir, '.node-version');
const toolVersionsPath = join(root, '.tool-versions');
let toolVersionsSummary = null;
if (existsSync(nodeVersionPath)) {
  const nodejs = nodeVersionFromFile(readFileSync(nodeVersionPath, 'utf8'));
  const pnpm = readPnpmPin(toolVersionsPath);
  writeFileSync(toolVersionsPath, `pnpm ${pnpm}\nnodejs ${nodejs}\n`);
  toolVersionsSummary = { preservedPnpm: pnpm, nodejs };
} else {
  console.warn(
    '[sync-from-upstream] Upstream missing .node-version; left .tool-versions unchanged',
  );
}

console.log(
  JSON.stringify(
    {
      wrote: {
        'package.json': {
          version: pkg.version,
          dependencies: Object.keys(pkg.dependencies).length,
          devDependencies: Object.keys(pkg.devDependencies).length,
          upstreamVersion: upstream.version,
        },
        copiedAsIs: copied,
        skippedCopy: skipped,
        '.tool-versions': toolVersionsSummary,
      },
      policy: 'docs/upstream-dotfiles.md',
    },
    null,
    2,
  ),
);
