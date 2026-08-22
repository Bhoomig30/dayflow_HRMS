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
    // scripts/ holds standalone Node dev-tooling (seeding, visual QA
    // screenshots) that isn't part of the shipped Next.js app and isn't run
    // through its module system — plain CommonJS is appropriate there, not
    // an app-wide lint exemption.
    "scripts/**",
  ]),
]);

export default eslintConfig;
