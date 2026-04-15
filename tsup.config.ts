import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/cli/index.ts', 'src/mcp/server.ts'],
  format: ['esm'],
  dts: true,
  clean: true,
  target: 'node22',
  splitting: true,
  sourcemap: true,
});
