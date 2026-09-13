import { defineConfig, type UserConfig } from 'tsdown'

const shared: Partial<UserConfig> = {
  platform: 'node',
  sourcemap: true,
  shims: true,
  fixedExtension: false,
  outputOptions: {
    keepNames: true,
  },
}

export default defineConfig({
  entry: 'src/index.ts',
  format: 'esm',
  dts: false,
  clean: true,
  ...shared,
})
