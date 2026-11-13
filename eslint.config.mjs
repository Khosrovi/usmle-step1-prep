import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Local scratch: extracted PDF text, generation plans and one-off helper
    // scripts. Gitignored, and not part of the shipped app, so linting it only
    // produced noise (it briefly masked the real error count).
    ".cache/**",
  ]),
]);

export default eslintConfig;
