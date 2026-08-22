import { defineConfig } from "vitest/config";
import path from "node:path";
import { TEST_DB_PATH, TEST_AUTH_SECRET, TEST_DOCS_DIR } from "./tests/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  test: {
    globalSetup: ["./tests/global-setup.ts"],
    testTimeout: 30_000,
    hookTimeout: 90_000,
    // The suite runs against ONE shared server + database (see
    // global-setup.ts) rather than an isolated instance per test file, so
    // files must not run concurrently against it — sequential execution
    // avoids cross-file interference on shared seeded state (e.g. two files
    // both listing/approving HR-visible leave requests at once).
    fileParallelism: false,
    // Any test file that imports service/db code directly (in-process,
    // no HTTP) — see tests/ai-tools.unit.test.ts — must resolve to the SAME
    // disposable test database and secret that global-setup.ts seeds and
    // that the spawned `next dev` test server was started with, never the
    // developer's real ./data/dayflow.db.
    env: {
      DATABASE_PATH: TEST_DB_PATH,
      AUTH_SECRET: TEST_AUTH_SECRET,
      DAYFLOW_DOCUMENT_STORAGE_DIR: TEST_DOCS_DIR,
    },
  },
});
