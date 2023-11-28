import { defineConfig } from 'vitest/config'
import eslint from 'vite-plugin-eslint'
import dts from 'vite-plugin-dts'
import autoprefixer from 'autoprefixer'

export default defineConfig({
  plugins: [
    eslint(),
    dts({ rollupTypes: true }),
  ],
  build: {
    lib: {
      entry: './src/index.ts',
      name: 'vuelit',
      formats: ['es', 'umd'],
    },
    rollupOptions: {
      external: ['@vue/reactivity', 'lit-html'],
      output: {
        globals: {
          '@vue/reactivity': 'VueReactivity',
          'lit-html': 'LitHtml',
        },
      },
    },
  },
  css: {
    postcss: {
      plugins: [
        autoprefixer(),
      ],
    },
  },
})
