import { defineConfig, type UserConfig } from 'tsdown'

const shared: Partial<UserConfig> = {
  deps: {
    alwaysBundle: ['@actions/core', '@actions/github', '@kubb/studio', 'jiti'],
    onlyBundle: false,
  },
  platform: 'node',
  minify: true,
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
