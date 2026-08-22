// Shared constants for the automated test suite. Kept in one place so the
// process that spawns the test server (global-setup.ts) and the test files
// that talk to it (via HTTP) and/or import service functions directly agree
// on exactly the same port / database file / secrets — no environment
// variable needs to travel between processes for this to work.
import path from "node:path";
import os from "node:os";

export const TEST_PORT = 3199;
export const BASE_URL = `http://127.0.0.1:${TEST_PORT}`;
export const TEST_DIR = path.join(os.tmpdir(), "dayflow-test-run");
export const TEST_DB_PATH = path.join(TEST_DIR, "dayflow-test.db");
export const TEST_DOCS_DIR = path.join(TEST_DIR, "documents");
// Test-only secret — never used outside this suite, never committed as a
// real deployment secret.
export const TEST_AUTH_SECRET = "dayflow-test-suite-secret-do-not-use-in-real-deployments-0123456789";

export const DEMO_PASSWORD = "Demo@1234";
