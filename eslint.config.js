import js from "@eslint/js";
import boundaries from "eslint-plugin-boundaries";
import tseslint from "typescript-eslint";

/**
 * Workspace lint config. Runs once from the repo root — see the `//#lint` note in
 * turbo.json — because the layer rules below classify files by their repo-relative path.
 */
export default tseslint.config(
  {
    // The three npm islands keep their own toolchains (see pnpm-workspace.yaml) and the
    // .NET tree is frozen on legacy/dotnet.
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/.next/**",
      "**/.turbo/**",
      "**/coverage/**",
      "src/**",
      "tests/**",
      "tools/golden/**",
      "e2e/**",
      "SPEC/**",
    ],
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  {
    files: ["**/*.{ts,tsx}"],
    rules: {
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports", fixStyle: "inline-type-imports" },
      ],
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },

  {
    // Nest reads constructor parameter types from emitDecoratorMetadata, which only emits a
    // real class reference for a value import. Rewriting an injected dependency to `import
    // type` — which consistent-type-imports does, and autofixes — makes Nest emit Object and
    // fail to resolve the provider at runtime, with lint and typecheck both green.
    files: ["apps/api/**/*.ts"],
    rules: { "@typescript-eslint/consistent-type-imports": "off" },
  },

  // Layer boundaries, per SPEC/50-typescript-migration.md §3. `default: "disallow"` means an
  // edge that is not listed is an error, so a new package is denied until it is declared here.
  {
    files: ["apps/**/*.{ts,tsx,js,jsx,mjs,cjs}", "packages/**/*.{ts,tsx,js,jsx,mjs,cjs}"],
    plugins: { boundaries },
    settings: {
      // See tsconfig.eslint.json: it maps @collega/* to source so the layer rules below
      // fire on a fresh clone. Without it an illegal import resolves to nothing, reads as
      // an external package, and passes silently.
      "import/resolver": {
        typescript: { project: "tsconfig.eslint.json" },
      },
      "boundaries/include": ["apps/**/*", "packages/**/*"],
      "boundaries/elements": [
        { type: "domain", pattern: "packages/domain" },
        { type: "application", pattern: "packages/application" },
        { type: "infrastructure", pattern: "packages/infrastructure" },
        { type: "design-system", pattern: "packages/design-system" },
        { type: "api", pattern: "apps/api" },
        { type: "web", pattern: "apps/web" },
      ],
    },
    rules: {
      "boundaries/dependencies": [
        "error",
        {
          default: "disallow",
          message: "{{from.type}} may not import {{to.type}} — see SPEC/50-typescript-migration.md §3.",
          policies: [
            { from: [{ element: { type: "domain" } }], allow: [] },
            {
              from: [{ element: { type: "application" } }],
              allow: [{ to: { element: { type: "domain" } } }],
            },
            {
              from: [{ element: { type: "infrastructure" } }],
              allow: [
                { to: { element: { type: "domain" } } },
                { to: { element: { type: "application" } } },
              ],
            },
            // Mirrors the .NET project graph: Collega.API references Application and
            // Infrastructure, never Domain directly.
            {
              from: [{ element: { type: "api" } }],
              allow: [
                { to: { element: { type: "application" } } },
                { to: { element: { type: "infrastructure" } } },
              ],
            },
            // Constraint 11 — HTTP-only Next <-> Nest. This is the edge the rule exists for:
            // apps/web reaches the server over HTTP and imports design-system, nothing else.
            {
              from: [{ element: { type: "web" } }],
              allow: [{ to: { element: { type: "design-system" } } }],
            },
            { from: [{ element: { type: "design-system" } }], allow: [] },
          ],
        },
      ],
      // A file or import that falls outside every declared element is a hole in the model
      // rather than a pass — a new package must be declared above before it can be used.
      "boundaries/no-unknown-files": "error",
      "boundaries/no-unknown-dependencies": "error",
    },
  },
);
