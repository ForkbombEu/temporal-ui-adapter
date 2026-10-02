import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [tailwindcss(), sveltekit()],
  // After `pnpm build` of the file: Adapter, wipe consumer `node_modules/.vite`
  // and restart Vite with `--force`. A stale optimizeDeps prebundle of an old
  // package copy was wedging /demo (evaluate-timeout / main-thread hang).
});
