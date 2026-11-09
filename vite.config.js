import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // three.js's WebGL renderer is ~570 kB on its own; it is a separate chunk loaded after the page.
  // Source maps: errors from the field point at real lines (the client code is public anyway).
  // manifest: the prerender reads it to preload each page's own chunks alongside the entry.
  // three's WebGPU renderer (Dogfight Extreme only) is a chunk of its own, so no chunk passes 160 kB brotli.
  build: {
    chunkSizeWarningLimit: 700, sourcemap: true, manifest: true,
    // (without pulling three's core in after it: the core stays shared with the WebGL pages).
    rolldownOptions: { output: { codeSplitting: { includeDependenciesRecursively: false, groups: [{ name: 'three-webgpu', test: /three[\\/]build[\\/]three\.webgpu\.js/ }] } } },
  },
});
