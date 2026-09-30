/** Language-tools / IDE config: Adapter `src/` resolves Upstream `$lib` the same way
 * the build stage does (see `.build/stage` in `build.mjs`). Upstream is never edited. */
/** @type {import('@sveltejs/kit').Config} */
const config = {
  compilerOptions: {
    runes: true,
  },
  kit: {
    alias: {
      $lib: 'upstream/src/lib',
      '$lib/*': 'upstream/src/lib/*',
      $types: 'upstream/src/lib/types',
      '$types/*': 'upstream/src/lib/types/*',
      '$components/*': 'upstream/src/components/*',
    },
  },
};

export default config;
