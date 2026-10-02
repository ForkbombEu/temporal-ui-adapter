import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

/** Vite + Kit plugin for `svelte-kit sync` at root. Run the Host via `examples/consumer`. */
export default defineConfig({
  plugins: [sveltekit()],
});
