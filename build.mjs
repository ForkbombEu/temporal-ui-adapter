/**
 * Canonical Adapter package build (repo root).
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
import { execFileSync, execSync } from 'node:child_process';
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
  openSync,
  closeSync,
  unlinkSync,
  symlinkSync,
  lstatSync,
} from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const upstream = resolve(process.env.UPSTREAM_DIR || join(here, 'upstream'));
const buildDir = join(here, '.build');
const stageDir = join(buildDir, 'stage');
const fullDist = join(buildDir, 'full');
const pkgDir = join(here, 'package');
const dist = join(pkgDir, 'dist');
const SCOPE = '.temporal-ui';
const PACKAGE_VERSION_SUFFIX = '-fb.0';
const lockPath = join(here, '.build.lock');
const packagingDir = join(here, 'packaging');

const adapterSrc = join(here, 'src');
const upstreamLib = join(upstream, 'src/lib');

if (!existsSync(join(adapterSrc, 'workflow-history.svelte'))) {
  console.error(`Adapter sources not found at ${adapterSrc}`);
  process.exit(1);
}
if (!existsSync(join(upstream, 'package.json'))) {
  console.error(
    `Upstream not found at ${upstream}. Set UPSTREAM_DIR or init the submodule.`,
  );
  process.exit(1);
}
if (!existsSync(join(here, 'node_modules/.bin/svelte-package'))) {
  console.error(
    `Root toolchain not installed (missing node_modules/.bin/svelte-package).\n` +
      `  node scripts/sync-from-upstream.mjs && pnpm install && pnpm exec svelte-kit sync`,
  );
  process.exit(1);
}
if (!existsSync(join(here, '.svelte-kit'))) {
  console.error(
    `Missing .svelte-kit at repo root. Run: pnpm exec svelte-kit sync`,
  );
  process.exit(1);
}

const requireRoot = createRequire(join(here, 'package.json'));
const bin = (name) => join(here, 'node_modules/.bin', name);

/** rmSync can hit transient ENOTEMPTY on macOS; retry then fall back to rm -rf. */
function rmrf(path) {
  try {
    lstatSync(path);
  } catch {
    return;
  }
  for (let i = 0; i < 8; i++) {
    try {
      rmSync(path, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
      try {
        lstatSync(path);
      } catch {
        return;
      }
    } catch {
      /* retry */
    }
    try {
      execSync(`rm -rf ${JSON.stringify(path)}`, { stdio: 'ignore' });
    } catch {
      /* retry */
    }
    try {
      lstatSync(path);
    } catch {
      return;
    }
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 100 * (i + 1));
  }
  throw new Error(`Failed to remove ${path}`);
}

function linkOrCopy(target, linkPath) {
  rmrf(linkPath);
  mkdirSync(dirname(linkPath), { recursive: true });
  symlinkSync(target, linkPath);
}

/** Stage Upstream lib + Adapter under `.build/stage` (Upstream tree stays pristine). */
function prepareStage() {
  rmrf(stageDir);
  const stageLib = join(stageDir, 'src/lib');
  mkdirSync(join(stageDir, 'src'), { recursive: true });
  cpSync(upstreamLib, stageLib, { recursive: true });

  const forkbombDir = join(stageLib, 'forkbomb');
  mkdirSync(forkbombDir, { recursive: true });
  // Adapter lives in root `src/` alongside Kit `app.html` — only copy package sources.
  for (const ent of readdirSync(adapterSrc, { withFileTypes: true })) {
    if (ent.name === 'app.html') continue;
    cpSync(join(adapterSrc, ent.name), join(forkbombDir, ent.name), { recursive: true });
  }

  const rootPkg = JSON.parse(readFileSync(join(here, 'package.json'), 'utf8'));
  writeFileSync(
    join(stageDir, 'package.json'),
    `${JSON.stringify(
      {
        name: '@forkbombeu/temporal-ui-stage',
        private: true,
        type: 'module',
        version: '0.0.0',
        peerDependencies: {
          ...(rootPkg.peerDependencies ?? {}),
        },
      },
      null,
      2,
    )}\n`,
  );

  cpSync(join(packagingDir, 'stage.svelte.config.js'), join(stageDir, 'svelte.config.js'));
  cpSync(join(packagingDir, 'stage.tsconfig.json'), join(stageDir, 'tsconfig.json'));

  linkOrCopy(join(here, 'node_modules'), join(stageDir, 'node_modules'));
  linkOrCopy(join(here, '.svelte-kit'), join(stageDir, '.svelte-kit'));
  // Upstream postcss loads `./tailwind.config.ts` from cwd — stage links that file below.
  linkOrCopy(join(upstream, 'postcss.config.cjs'), join(stageDir, 'postcss.config.cjs'));
  linkOrCopy(join(upstream, 'tailwind.config.ts'), join(stageDir, 'tailwind.config.ts'));
  // $components/* and app.css live outside lib; link for preprocess / rare imports.
  linkOrCopy(join(upstream, 'src/components'), join(stageDir, 'src/components'));
  linkOrCopy(join(upstream, 'src/app.css'), join(stageDir, 'src/app.css'));

  if (!existsSync(join(stageLib, 'forkbomb/index.ts'))) {
    throw new Error(`Stage missing Adapter entry: ${join(stageLib, 'forkbomb/index.ts')}`);
  }
  return stageLib;
}

function packageName(spec) {
  return spec.startsWith('@') ? spec.split('/').slice(0, 2).join('/') : spec.split('/')[0];
}

function isBare(id) {
  return !id.startsWith('.') && !id.startsWith('/') && !id.startsWith('\0');
}

/** Collect runtime module ids + bare imports via a throwaway Vite/Rollup lib build. */
async function collectGraph(entryRelative) {
  const { build } = await import(pathToFileURL(requireRoot.resolve('vite')).href);
  const { svelte } = await import(
    pathToFileURL(requireRoot.resolve('@sveltejs/vite-plugin-svelte')).href
  );
  const runtimeFiles = new Set();
  const runtimeImports = new Set();
  const entry = join(fullDist, entryRelative);
  if (!existsSync(entry)) {
    throw new Error(`Graph entry missing: ${entry}`);
  }
  await build({
    root: fullDist,
    logLevel: 'error',
    configFile: false,
    css: { postcss: {} },
    plugins: [
      svelte({ configFile: false, compilerOptions: { css: 'external' } }),
      {
        name: 'collect-graph',
        buildEnd() {
          for (const id of this.getModuleIds()) {
            const file = id.split('?')[0];
            if (file.startsWith(fullDist)) runtimeFiles.add(file);
          }
        },
      },
    ],
    build: {
      write: false,
      lib: { entry, formats: ['es'] },
      rollupOptions: {
        external: (id) => {
          if (isBare(id)) {
            runtimeImports.add(id);
            return true;
          }
          return false;
        },
      },
    },
  });
  return { runtimeFiles, runtimeImports };
}

function expandDeclarationGraph(runtimeFiles) {
  const keep = new Set(runtimeFiles);
  const typeImports = new Set();
  const declarationFor = (file) =>
    file.endsWith('.svelte') ? `${file}.d.ts` : file.replace(/\.js$/, '.d.ts');
  const queue = [...runtimeFiles].map(declarationFor).filter(existsSync);
  while (queue.length) {
    const file = queue.pop();
    if (keep.has(file)) continue;
    keep.add(file);
    const source = readFileSync(file, 'utf8');
    for (const [, spec] of source.matchAll(/(?:from\s+|import\()\s*['"]([^'"]+)['"]/g)) {
      if (!spec.startsWith('.')) {
        typeImports.add(spec);
        continue;
      }
      const target = resolve(dirname(file), spec);
      const candidates = [
        `${target}.svelte.d.ts`,
        target.endsWith('.svelte') ? `${target}.d.ts` : null,
        target.replace(/\.js$/, '.d.ts'),
        `${target}.d.ts`,
        join(target, 'index.d.ts'),
      ].filter(Boolean);
      const found = candidates.find((c) => existsSync(c) && statSync(c).isFile());
      if (found) queue.push(found);
    }
  }
  return { keep, typeImports };
}

/**
 * Rewrite bare document/root selectors so Host html/body are untouched.
 * Tailwind `important` only scopes utilities — preflight/base still emit html/body/:root/hN.
 */
function scopeBareSelectors(css, scope = SCOPE) {
  return (
    css
      .replaceAll(':root', scope)
      .replace(/(^|[\s,}(+>~])html(?=[\s,{.#:[\]>+~]|$)/gm, `$1${scope}`)
      .replace(/(^|[\s,}(+>~])body(?=[\s,{.#:[\]>+~]|$)/gm, `$1${scope}`)
      .replace(/(^|[\s,}(+>~])(h[1-6])(?=[\s,{.#:[\]>+~]|$)/gm, `$1${scope} $2`)
  );
}

function contentFiles(runtimeFiles) {
  return [...runtimeFiles].filter((f) => /\.(svelte|js)$/.test(f));
}

function compileScopedCss(content, outFile, label) {
  mkdirSync(buildDir, { recursive: true });
  const cssInput = join(buildDir, `input-${label}.css`);
  writeFileSync(cssInput, readFileSync(join(upstream, 'src/app.css'), 'utf8'));
  const twConfig = join(buildDir, `tailwind-${label}.cjs`);
  writeFileSync(
    twConfig,
    `const base = require(${JSON.stringify(join(upstream, 'tailwind.config.ts'))}).default;
module.exports = {
  ...base,
  content: ${JSON.stringify(content)},
  important: ${JSON.stringify(SCOPE)},
};
`,
  );
  const tmpOut = join(buildDir, `out-${label}.css`);
  execFileSync(
    bin('tailwindcss'),
    ['-c', twConfig, '-i', cssInput, '-o', tmpOut, '--minify'],
    { cwd: here, stdio: 'inherit' },
  );
  const scoped = scopeBareSelectors(readFileSync(tmpOut, 'utf8'));
  mkdirSync(dirname(outFile), { recursive: true });
  writeFileSync(outFile, scoped);
}

/**
 * Vendor Buf-registry packages (`@buf/*`) into dist/vendor so Hosts need no Buf `.npmrc`.
 * Leave `@bufbuild/protobuf` as a normal dependency — it is on the public npm registry, and
 * vendoring it breaks package subpath imports (`@bufbuild/protobuf/codegenv2`).
 * Returns package names successfully vendored (removed from dependencies).
 */
function vendorBufPackages(runtimeUsed) {
  const bufNames = [...runtimeUsed].filter((n) => n.startsWith('@buf/'));
  if (!bufNames.length) return new Set();

  const vendored = new Set();
  const vendorRoot = join(dist, 'vendor');
  mkdirSync(vendorRoot, { recursive: true });

  for (const name of bufNames) {
    let pkgRoot;
    try {
      pkgRoot = dirname(requireRoot.resolve(`${name}/package.json`));
    } catch {
      const nm = join(here, 'node_modules', ...name.split('/'));
      if (existsSync(nm)) pkgRoot = nm;
    }
    if (!pkgRoot || !existsSync(pkgRoot)) {
      console.warn(
        `[build] Could not resolve ${name} for vendoring; leaving in dependencies (Host may need Buf registry).`,
      );
      continue;
    }
    const dest = join(vendorRoot, ...name.split('/'));
    rmrf(dest);
    mkdirSync(dirname(dest), { recursive: true });
    // pnpm store paths are often symlinks; npm pack does not follow them into the tarball.
    cpSync(pkgRoot, dest, { recursive: true, dereference: true });
    vendored.add(name);
  }

  if (!vendored.size) return vendored;

  const rewriteWalk = (dir) => {
    for (const ent of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, ent.name);
      if (ent.isDirectory()) {
        rewriteWalk(p);
        continue;
      }
      if (!/\.(js|svelte\.js|mjs|cjs)$/.test(ent.name)) continue;
      let src = readFileSync(p, 'utf8');
      let changed = false;
      for (const name of vendored) {
        const relToVendor = relative(dirname(p), join(vendorRoot, ...name.split('/'))).replace(
          /\\/g,
          '/',
        );
        const prefix = relToVendor.startsWith('.') ? relToVendor : `./${relToVendor}`;
        const re = new RegExp(
          `(from\\s+|import\\s*\\(\\s*)(['"])${name.replace(/\//g, '\\/')}(\\/[^'"]*)?\\2`,
          'g',
        );
        src = src.replace(re, (_full, head, quote, sub = '') => {
          changed = true;
          return `${head}${quote}${prefix}${sub}${quote}`;
        });
      }
      if (changed) writeFileSync(p, src);
    }
  };
  rewriteWalk(dist);
  return vendored;
}

// Exclusive lock — concurrent builds race on `.build/stage` / package output.
let lockFd;
try {
  lockFd = openSync(lockPath, 'wx');
} catch {
  console.error(`Another build holds ${lockPath}; aborting.`);
  process.exit(1);
}
const releaseLock = () => {
  try { closeSync(lockFd); } catch {}
  try { unlinkSync(lockPath); } catch {}
};
process.on('exit', releaseLock);
process.on('SIGINT', () => { releaseLock(); process.exit(130); });
process.on('SIGTERM', () => { releaseLock(); process.exit(143); });

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
const upstreamPkg = JSON.parse(readFileSync(join(upstream, 'package.json'), 'utf8'));
const runtimeUsed = new Set([...runtimeImports].map(packageName));
const typeOnlyUsed = new Set(
  [...typeImports].map(packageName).filter((n) => !runtimeUsed.has(n)),
);
const used = new Set([...runtimeUsed, ...typeOnlyUsed]);
const declared = { ...upstreamPkg.devDependencies, ...upstreamPkg.dependencies };
const pick = (names, deps = declared) =>
  Object.fromEntries(Object.entries(deps).filter(([name]) => names.has(name)));

const peerDependencies = {
  ...pick(used, upstreamPkg.peerDependencies),
  ...pick(new Set([...typeOnlyUsed].filter((n) => !(n in upstreamPkg.peerDependencies)))),
};
if ([...runtimeUsed].some((n) => n.startsWith('$app'))) {
  peerDependencies['@sveltejs/kit'] = upstreamPkg.peerDependencies['@sveltejs/kit'];
}
const peerDependenciesMeta = Object.fromEntries(
  Object.keys(peerDependencies)
    .filter((n) => typeOnlyUsed.has(n) && !(n in upstreamPkg.peerDependencies))
    .map((n) => [n, { optional: true }]),
);

let dependencies = pick(
  new Set([...runtimeUsed].filter((n) => !(n in upstreamPkg.peerDependencies))),
);

const vendoredBuf = vendorBufPackages(runtimeUsed);
for (const name of vendoredBuf) delete dependencies[name];

const version = `${upstreamPkg.version}${PACKAGE_VERSION_SUFFIX}`;

writeFileSync(
  join(pkgDir, 'package.json'),
  `${JSON.stringify(
    {
      name: '@forkbombeu/temporal-ui',
      version,
      type: 'module',
      license: 'MIT',
      files: ['dist'],
      sideEffects: ['**/*.css'],
      exports: {
        '.': {
          types: './dist/forkbomb/index.d.ts',
          svelte: './dist/forkbomb/index.js',
          default: './dist/forkbomb/index.js',
        },
      },
      peerDependencies,
      peerDependenciesMeta,
      dependencies,
    },
    null,
    2,
  )}\n`,
);

const unresolved = [...used].filter(
  (n) =>
    !n.startsWith('$app') &&
    !(n in dependencies) &&
    !(n in peerDependencies) &&
    !vendoredBuf.has(n) &&
    !n.startsWith('node:'),
);

const bufRegistryOnGraph = [...runtimeUsed].filter((n) => n.startsWith('@buf/'));
if (bufRegistryOnGraph.some((n) => !vendoredBuf.has(n))) {
  console.warn(
    '[build] TODO(forkbomb): some @buf/* packages remain as dependencies — Host may need Buf registry (.npmrc @buf:registry=https://buf.build/gen/npm/v1/).',
  );
}

console.log(
  JSON.stringify(
    {
      adapterSrc: relative(here, adapterSrc),
      upstream: relative(here, upstream) || upstream,
      upstreamVersion: upstreamPkg.version,
      version,
      packagedFiles: keep.size,
      runtimeModules: runtimeFiles.size,
      statusCssModules: statusGraph.runtimeFiles.size,
      historyCssModules: historyGraph.runtimeFiles.size,
      dependencies: Object.keys(dependencies).length,
      vendoredBuf: [...vendoredBuf],
      unresolvedBareImports: unresolved,
      css: [
        'dist/forkbomb/workflow-status.css',
        'dist/forkbomb/workflow-history.css',
      ],
    },
    null,
    2,
  ),
);
