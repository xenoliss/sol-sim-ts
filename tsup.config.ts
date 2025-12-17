import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    'lite-sim/index': 'src/lite-sim/index.ts',
    'mcm-runner/index': 'src/mcm-runner/index.ts',
    'mcm-runner/cli': 'src/mcm-runner/cli.ts',
  },
  format: ['esm'],
  dts: true,
  clean: true,
  sourcemap: true,
  splitting: false,
  outDir: 'dist',
  platform: 'node',
  target: 'node18',
  shims: true,
  external: [
    '@solana/kit',
    '@solana/compat',
    '@solana/web3.js',
    'litesvm',
    '@noble/hashes',
  ],
});
