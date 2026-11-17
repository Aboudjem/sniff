import { readFileSync } from 'node:fs';
import { defineConfig } from 'tsup';

// Since 0.9.1 the runtime dependencies are bundled into dist/, so the npm
// package has one dependency (zod, for the public config types). A cold
// `npx -y sniff-qa --mcp` then downloads one small tarball and answers the MCP
// handshake in seconds. scripts/third-party-notices.mjs writes the licenses of
// everything bundled. Kept external:
// - the browser engine, installed on demand (src/core/engine.ts);
// - typescript, an optional loader of cosmiconfig, used only when present;
// - the template engines @vue/compiler-sfc can call for <template lang="...">.
//   They were never sniff dependencies; a .vue file that needs one fails the
//   same way it did before.
const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));
const engine = Object.keys(pkg.engineDependencies as Record<string, string>);
const VUE_TEMPLATE_ENGINES = ["atpl", "babel-core", "bracket-template", "coffee-script", "dot", "dustjs-linkedin", "eco", "ect", "ejs", "haml-coffee", "hamlet", "hamljs", "handlebars", "hogan.js", "htmling", "jazz", "jqtpl", "just", "liquor", "lodash", "marko", "mote", "mustache", "plates", "ractive", "react-dom/server", "react", "slm", "squirrelly", "teacup/lib/express", "templayed", "toffee", "twig", "twing", "underscore", "vash", "velocityjs", "walrus", "whiskers"];

export default defineConfig({
  entry: ['src/index.ts', 'src/cli/index.ts', 'src/mcp/server.ts'],
  format: ['esm'],
  dts: true,
  clean: true,
  target: 'node22',
  splitting: true,
  sourcemap: false,
  external: [...engine, 'typescript', ...VUE_TEMPLATE_ENGINES],
  // Bundled CommonJS code calls require(); give the ESM output one.
  banner: {
    js: "import { createRequire as __sniffCreateRequire } from 'node:module'; const require = __sniffCreateRequire(import.meta.url);",
  },
  // Read by scripts/third-party-notices.mjs, which then deletes it.
  metafile: true,
});
