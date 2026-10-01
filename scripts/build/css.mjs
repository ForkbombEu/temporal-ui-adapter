import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { bin, buildDir, here, SCOPE, upstream } from './paths.mjs';

/**
 * Rewrite bare document/root selectors so Host html/body are untouched.
 * Tailwind `important` only scopes utilities — preflight/base still emit html/body/:root/hN.
 */
export function scopeBareSelectors(css, scope = SCOPE) {
  return (
    css
      .replaceAll(':root', scope)
      .replace(/(^|[\s,}(+>~])html(?=[\s,{.#:[\]>+~]|$)/gm, `$1${scope}`)
      .replace(/(^|[\s,}(+>~])body(?=[\s,{.#:[\]>+~]|$)/gm, `$1${scope}`)
      .replace(/(^|[\s,}(+>~])(h[1-6])(?=[\s,{.#:[\]>+~]|$)/gm, `$1${scope} $2`)
  );
}

export function contentFiles(runtimeFiles) {
  return [...runtimeFiles].filter((f) => /\.(svelte|js)$/.test(f));
}

export function compileScopedCss(content, outFile, label) {
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
