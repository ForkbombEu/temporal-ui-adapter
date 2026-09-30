import { sveltePreprocess } from 'svelte-preprocess';

/** Stage config for svelte-package (copied into `.build/stage/` by build.mjs). */
/** @type {import('@sveltejs/kit').Config} */
export default {
  preprocess: [sveltePreprocess({ postcss: true })],
  compilerOptions: {
    runes: ({ filename }) =>
      filename.includes('node_modules') ? undefined : true,
  },
  kit: {
    alias: {
      $lib: 'src/lib',
      '$lib/*': 'src/lib/*',
      $types: 'src/lib/types',
      '$types/*': 'src/lib/types/*',
      '$components/*': 'src/components/*',
    },
  },
};
