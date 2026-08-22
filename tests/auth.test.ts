import { describe, it, expect } from "vitest";
import { apiFetch, signIn, uniqueCode } from "./helpers";

describe("auth: signup", () => {
  it("successful signup creates an unverified account and does NOT set a session cookie", async () => {
    const employeeCode = uniqueCode("EMP");
    const res = await apiFetch("/api/auth/signup", {
      method: "POST",
      body: JSON.stringify({
        fullName: "New Hire",
        employeeCode,
        email: `${employeeCode.toLowerCase()}@dayflow.test`,
        password: "TestPass1",
      }),
    });
    expect(res.status).toBe(201);
    expect(res.headers.get("set-cookie")).toBeNull();
    const body = await res.json();
    expect(body.verificationRequired).toBe(true);
    expect(body.devEmailVerificationLink).toBeTruthy();
  });

  it("cannot sign in before verifying email", async () => {
    const employeeCode = uniqueCode("EMP");
    const password = "TestPass1";
    await apiFetch("/api/auth/signup", {
      method: "POST",
      body: JSON.stringify({ fullName: "Unverified Person", employeeCode, email: `${employeeCode.toLowerCase()}@dayflow.test`, password }),
    });
    const res = await apiFetch("/api/auth/signin", { method: "POST", body: JSON.stringify({ identifier: employeeCode, password }) });
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error.message.toLowerCase()).toContain("verify");
  });

  it("can sign in after verifying email via the dev verification link", async () => {
    const employeeCode = uniqueCode("EMP");
    const password = "TestPass1";
    const signUpRes = await apiFetch("/api/auth/signup", {
      method: "POST",
      body: JSON.stringify({ fullName: "Verified Person", employeeCode, email: `${employeeCode.toLowerCase()}@dayflow.test`, password }),
    });
    const { devEmailVerificationLink } = await signUpRes.json();
    const verifyRes = await apiFetch(devEmailVerificationLink);
    expect(verifyRes.status).toBeGreaterThanOrEqual(300);
    expect(verifyRes.status).toBeLessThan(400);
    expect(verifyRes.headers.get("location")).toContain("verified=1");

    const signInRes = await apiFetch("/api/auth/signin", { method: "POST", body: JSON.stringify({ identifier: employeeCode, password }) });
    expect(signInRes.status).toBe(200);
    expect(signInRes.headers.get("set-cookie")).toBeTruthy();
  });

  it("public signup can never create an HR account, even if role is injected in the request body", async () => {
    const employeeCode = uniqueCode("EMP");
    const password = "TestPass1";
    const signUpRes = await apiFetch("/api/auth/signup", {
      method: "POST",
      body: JSON.stringify({
        fullName: "Aspiring Admin",
        employeeCode,
        email: `${employeeCode.toLowerCase()}@dayflow.test`,
        password,
        role: "HR", // not part of the public signup schema — must be ignored, not honored
      }),
    });
    const body = await signUpRes.json();
    expect(body.user.role).toBe("EMPLOYEE");
  });

  it("rejects duplicate email", async () => {
    const employeeCode1 = uniqueCode("EMP");
    const employeeCode2 = uniqueCode("EMP");
    const email = `${uniqueCode("dup").toLowerCase()}@dayflow.test`;
    await apiFetch("/api/auth/signup", {
      method: "POST",
      body: JSON.stringify({ fullName: "First", employeeCode: employeeCode1, email, password: "TestPass1" }),
    });
    const res = await apiFetch("/api/auth/signup", {
      method: "POST",
      body: JSON.stringify({ fullName: "Second", employeeCode: employeeCode2, email, password: "TestPass1" }),
    });
    expect(res.status).toBe(409);
  });

  it("rejects duplicate employee ID", async () => {
    const employeeCode = uniqueCode("EMP");
    await apiFetch("/api/auth/signup", {
      method: "POST",
      body: JSON.stringify({ fullName: "First", employeeCode, email: `${uniqueCode("a").toLowerCase()}@dayflow.test`, password: "TestPass1" }),
    });
    const res = await apiFetch("/api/auth/signup", {
      method: "POST",
      body: JSON.stringify({ fullName: "Second", employeeCode, email: `${uniqueCode("b").toLowerCase()}@dayflow.test`, password: "TestPass1" }),
    });
    expect(res.status).toBe(409);
  });

  it("rejects a weak password with a clear validation message, not a raw stack trace", async () => {
    const employeeCode = uniqueCode("EMP");
    const res = await apiFetch("/api/auth/signup", {
      method: "POST",
      body: JSON.stringify({ fullName: "Weak Pw", employeeCode, email: `${employeeCode.toLowerCase()}@dayflow.test`, password: "weak" }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBeDefined();
    expect(body.error.message).not.toMatch(/at .*\(.*:\d+:\d+\)/); // no stack-trace-looking content
  });
});

describe("auth: signin/signout", () => {
  it("signs in with seeded demo credentials (Employee ID)", async () => {
    const session = await signIn("EMP1001");
    expect(session.role).toBe("EMPLOYEE");
    expect(session.employeeCode).toBe("EMP1001");
  });

  it("signs in with seeded demo credentials (email)", async () => {
    const session = await signIn("aditya@dayflow.demo");
    expect(session.employeeCode).toBe("EMP1001");
  });

  it("rejects an incorrect password", async () => {
    const res = await apiFetch("/api/auth/signin", { method: "POST", body: JSON.stringify({ identifier: "EMP1001", password: "WrongPassword1" }) });
    expect(res.status).toBe(401);
  });

  it("rejects a nonexistent identifier", async () => {
    const res = await apiFetch("/api/auth/signin", { method: "POST", body: JSON.stringify({ identifier: "NOSUCHUSER", password: "whatever1A" }) });
    expect(res.status).toBe(401);
  });

  it("signout clears the session so a subsequent protected request is unauthenticated", async () => {
    const session = await signIn("EMP1001");
    const signOutRes = await apiFetch("/api/auth/signout", { method: "POST", cookie: session.cookie });
    expect(signOutRes.status).toBe(200);
    const clearedCookie = signOutRes.headers.get("set-cookie");
    expect(clearedCookie).toContain("dayflow_session=;");

    const meRes = await apiFetch("/api/auth/session", { cookie: clearedCookie!.split(";")[0] });
    const body = await meRes.json();
    expect(body.authenticated).toBe(false);
  });
});

describe("auth: protected routes", () => {
  it("an unauthenticated request to a protected API route is rejected", async () => {
    const res = await apiFetch("/api/notifications");
    expect(res.status).toBe(401);
  });

  it("malformed JSON body is reported as a 400, not a 500", async () => {
    const res = await apiFetch("/api/auth/signin", { method: "POST", body: "{not json" });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("BAD_REQUEST");
  });
});
const express = require("express");

const {
  signup,
  verifyEmail,
  login,
  getMe,
  logout,
} = require("../controllers/authController");

const protect = require("../middleware/authMiddleware");

const router = express.Router();

router.post("/signup", signup);

router.post("/verify-email", verifyEmail);

router.post("/login", login);

router.get("/me", protect, getMe);

router.post("/logout", logout);

module.exports = router;
