import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: {
    main: 'src/main.ts',
  },
  outDir: 'dist',
  unbundle: true
})
