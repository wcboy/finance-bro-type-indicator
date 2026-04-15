import { defineConfig } from 'vite'

export default defineConfig({
  base: '/finance-bro-type-indicator/',
  build: {
    outDir: 'dist',
    assetsDir: 'assets'
  },
  define: {
    __APP_NAME__: '"Finance Bro Type Indicator"',
    __APP_SHORT_NAME__: '"FBTI"'
  }
})
