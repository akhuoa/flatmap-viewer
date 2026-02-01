import path from 'path'
import { defineConfig } from 'vite'
import dts from 'vite-plugin-dts'
import { libInjectCss } from 'vite-plugin-lib-inject-css'

export default defineConfig({
  plugins: [
    dts({ include: ['lib'] }),
    libInjectCss()
  ],
  build: {
    copyPublicDir: false,
    cssCodeSplit: true,
    lib: {
      formats: ['es'],
      entry: path.resolve(__dirname, 'lib/index.ts'),
      name: 'FlatmapViewer'
    },
    rollupOptions: {
      external: [
        /@deck\.gl\/.*/,
        /@luma\.gl\/.*/
      ],
      output: {
        // Put chunk files at <output>/chunks
        chunkFileNames: 'chunks/[name].[hash].js',
        // Put chunk styles at <output>/assets
        assetFileNames: 'assets/[name][extname]',
        entryFileNames: '[name].js',
        // Externalize peer dependencies
        globals: {
          '@deck.gl/core': '@deck.gl/core',
          '@deck.gl/layers': '@deck.gl/layers',
          '@deck.gl/geo-layers': '@deck.gl/geo-layers',
          '@deck.gl/mapbox': '@deck.gl/mapbox',
          '@luma.gl/engine': '@luma.gl/engine'
        }
      }
    }
  },
})
