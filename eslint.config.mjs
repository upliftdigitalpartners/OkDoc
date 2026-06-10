import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import jsxA11y from "eslint-plugin-jsx-a11y";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // WCAG 2.2 AA is non-negotiable — jsx-a11y at strict level. The plugin
      // itself is already registered by eslint-config-next; only the rules
      // are applied here to avoid a duplicate-plugin error.
      ...jsxA11y.flatConfigs.strict.rules,
      // Physical-direction utilities break RTL (Arabic/Urdu). Logical only.
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "JSXAttribute[name.name='className'] Literal[value=/(^|[\\s:])(ml-|mr-|pl-|pr-|left-|right-|text-left|text-right)/]",
          message:
            "Use CSS logical properties (ms-/me-/ps-/pe-/start-/end-/text-start/text-end) instead of physical left/right utilities — RTL support.",
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "test-results/**",
    "playwright-report/**",
  ]),
]);

export default eslintConfig;
