// @ts-check
import { defineConfig } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  // TODO: Set the production domain when it's confirmed (e.g. "https://frio-puro.com")
  // site: "https://example.com",
  vite: {
    plugins: [tailwindcss()],
    optimizeDeps: {
      include: ["axobject-query"]
    }
  }
});
