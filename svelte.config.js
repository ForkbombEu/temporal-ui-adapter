import adapter from '@sveltejs/adapter-static';
import { sveltePreprocess } from 'svelte-preprocess';

/**
 * Kit config for IDE + `svelte-kit sync` only — no app routes here.
 * Smoke Host / +page lives in `examples/consumer`.
 * `$lib` means Upstream (same mental model as the package stage).
 * Adapter sources live in `src/*.svelte` (not under `$lib`).
 */
/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: [sveltePreprocess({ postcss: true })],
  compilerOptions: {
    runes: ({ filename }) =>
      filename.includes('node_modules') ? undefined : true,
  },
  kit: {
    adapter: adapter({
      fallback: 'index.html',
      pages: 'build',
      assets: 'build',
    }),
    alias: {
      $lib: 'upstream/src/lib',
      '$lib/*': 'upstream/src/lib/*',
      $types: 'upstream/src/lib/types',
      '$types/*': 'upstream/src/lib/types/*',
      '$components/*': 'upstream/src/components/*',
    },
    prerender: { entries: [] },
  },
};

export default config;
