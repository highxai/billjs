import { defineConfig } from "bunup";

export default defineConfig({
  entry: "src/index.ts",
  format: ["esm", "cjs"],
  exports: true,
  unused: true,
  minify: true,
  minifyIdentifiers: true,
  minifySyntax: true,
  minifyWhitespace: true,
  splitting: true,
  sourcemap: true,
  clean: true,
  target: "node",
});
