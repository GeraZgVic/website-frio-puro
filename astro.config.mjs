// @ts-check
import { defineConfig } from 'astro/config';
import node from "@astrojs/node";
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  site: "https://friopuro.com.mx",
  output: "server",
  adapter: node({ mode: "standalone" }),
  security: {
    checkOrigin: true,
  },
  vite: {
    plugins: [tailwindcss()]
  },
});
