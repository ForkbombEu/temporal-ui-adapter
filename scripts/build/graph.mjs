import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { fullDist, requireRoot } from './paths.mjs';

export function packageName(spec) {
  return spec.startsWith('@') ? spec.split('/').slice(0, 2).join('/') : spec.split('/')[0];
}

export function isBare(id) {
  return !id.startsWith('.') && !id.startsWith('/') && !id.startsWith('\0');
}

/** Collect runtime module ids + bare imports via a throwaway Vite/Rollup lib build. */
export async function collectGraph(entryRelative) {
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

export function expandDeclarationGraph(runtimeFiles) {
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
