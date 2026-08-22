import { spawn, execFileSync, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { TEST_PORT, BASE_URL, TEST_DIR, TEST_DB_PATH, TEST_DOCS_DIR, TEST_AUTH_SECRET } from "./config";

const ROOT = process.cwd();

function testEnv(): NodeJS.ProcessEnv {
  return {
    ...process.env,
    DATABASE_PATH: TEST_DB_PATH,
    AUTH_SECRET: TEST_AUTH_SECRET,
    DAYFLOW_DOCUMENT_STORAGE_DIR: TEST_DOCS_DIR,
    // Deliberately unset so the AI "unavailable" state is what's under
    // test — this suite never talks to a real AI provider. GROQ_API_KEY is
    // checked first by getAIProvider() (see lib/ai/provider.ts), so it must
    // be unset here too — otherwise a real key sitting in the host shell's
    // environment would leak into the test server and this suite would
    // silently start making real Groq API calls instead of exercising the
    // "unavailable" path it's actually testing.
    GROQ_API_KEY: "",
    GROQ_MODEL: "",
    AI_PROVIDER: "",
    AI_API_KEY: "",
    AI_MODEL: "",
    NODE_ENV: "development",
  };
}

async function waitUntilReady(deadlineMs: number) {
  const deadline = Date.now() + deadlineMs;
  let lastErr: unknown;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(BASE_URL + "/");
      if (res.status) return;
    } catch (err) {
      lastErr = err;
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  throw new Error(`Test server on ${BASE_URL} did not become ready in time: ${String(lastErr)}`);
}

function killGroup(child: ChildProcess, signal: NodeJS.Signals) {
  if (!child.pid) return;
  try {
    process.kill(-child.pid, signal);
  } catch {
    try {
      child.kill(signal);
    } catch {
      /* already dead */
    }
  }
}

export default async function globalSetup() {
  fs.rmSync(TEST_DIR, { recursive: true, force: true });
  fs.mkdirSync(TEST_DIR, { recursive: true });

  const env = testEnv();

  // Seed HR001 / EMP1001-1006 demo data directly against the test database
  // — gives the suite a known HR account (public signup can never create
  // one) plus a realistic employee population, exactly like a developer
  // running `npm run seed` locally.
  execFileSync("npx", ["tsx", path.join(ROOT, "scripts", "seed.ts")], {
    cwd: ROOT,
    env,
    stdio: process.env.CI ? "pipe" : "ignore",
  });

  const child = spawn("npx", ["next", "dev", "-p", String(TEST_PORT)], {
    cwd: ROOT,
    env,
    detached: true,
    stdio: "pipe",
  });
  child.stderr?.on("data", () => {
    /* swallow — surfaced only on failure via the readiness error below */
  });

  try {
    await waitUntilReady(60_000);
  } catch (err) {
    killGroup(child, "SIGKILL");
    throw err;
  }

  return async () => {
    killGroup(child, "SIGTERM");
    await new Promise((r) => setTimeout(r, 500));
    killGroup(child, "SIGKILL");
  };
}
