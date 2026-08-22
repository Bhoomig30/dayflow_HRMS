"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { LogIn, Send } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Input";
import { Alert } from "@/components/ui/Alert";
import { api, ClientApiError } from "@/lib/client/api";

interface ResendResponse {
  message: string;
  devEmailVerificationLink?: string;
}

function SignInForm() {
  const router = useRouter();
  const params = useSearchParams();
  const redirectTo = params.get("redirect");
  const verified = params.get("verified");

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendResult, setResendResult] =
    useState<ResendResponse | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();

    setError(null);
    setErrorCode(null);
    setResendResult(null);
    setLoading(true);

    try {
      const res = await api.post<{
        user: { role: "EMPLOYEE" | "HR" };
      }>("/api/auth/signin", {
        identifier,
        password,
      });

      router.push(
        redirectTo ||
          (res.user.role === "HR" ? "/hr" : "/dashboard")
      );

      router.refresh();
    } catch (err) {
      if (err instanceof ClientApiError) {
        setError(err.message);
        setErrorCode(err.code ?? null);
      } else {
        setError("Something went wrong. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  async function onResend() {
    setResending(true);
    setResendResult(null);

    try {
      const res = await api.post<ResendResponse>(
        "/api/auth/resend-verification",
        { identifier }
      );

      setResendResult(res);
    } catch {
      setResendResult({
        message: "Something went wrong. Please try again.",
      });
    } finally {
      setResending(false);
    }
  }

  return (
    <div className="w-full max-w-sm">
      <div className="mb-8 flex items-center gap-2.5">
        <div className="flex size-9 items-center justify-center rounded-[var(--df-radius-md)] bg-[var(--df-accent-soft)] font-bold text-[var(--df-accent)]">
          D
        </div>

        <span className="text-sm font-semibold text-[var(--df-text-primary)]">
          Dayflow
        </span>
      </div>

      <h1 className="text-2xl font-semibold text-[var(--df-text-primary)]">
        Welcome back
      </h1>

      <p className="mt-1 text-sm text-[var(--df-text-muted)]">
        Sign in with your email or Employee ID.
      </p>

      <form
        onSubmit={onSubmit}
        className="mt-6 space-y-4"
        noValidate
      >
        {verified === "1" && (
          <Alert tone="success">
            Email verified — you can now sign in.
          </Alert>
        )}

        {verified === "0" && (
          <Alert tone="danger">
            That verification link is invalid, expired, or has
            already been used.
          </Alert>
        )}

        {error && (
          <Alert tone="danger">
            {error}
          </Alert>
        )}

        {errorCode === "EMAIL_NOT_VERIFIED" && !resendResult && (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            loading={resending}
            onClick={onResend}
            disabled={!identifier}
          >
            <Send className="size-3.5" />
            Resend verification email
          </Button>
        )}

        {resendResult && (
          <Alert tone="info" className="text-left">
            {resendResult.devEmailVerificationLink ? (
              <>
                No email provider is configured in this environment,
                so Dayflow can&apos;t actually send a verification
                email. In a deployment with a real provider
                configured, this link would be emailed instead of
                shown here:

                <br />

                <Link
                  href={resendResult.devEmailVerificationLink}
                  className="mt-1 inline-block break-all font-medium text-[var(--df-accent)] hover:underline"
                >
                  {resendResult.devEmailVerificationLink}
                </Link>
              </>
            ) : (
              resendResult.message
            )}
          </Alert>
        )}

        <div>
          <Label htmlFor="identifier">
            Email or Employee ID
          </Label>

          <Input
            id="identifier"
            autoComplete="username"
            required
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            placeholder="you@company.com or EMP1001"
          />
        </div>

        <div>
          <Label htmlFor="password">
            Password
          </Label>

          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
          />
        </div>

        <Button
          type="submit"
          className="w-full"
          loading={loading}
        >
          <LogIn className="size-4" />
          Sign in
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-[var(--df-text-muted)]">
        New to Dayflow?{" "}

        <Link
          href="/sign-up"
          className="font-medium text-[var(--df-accent)] hover:underline"
        >
          Create an account
        </Link>
      </p>
    </div>
  );
}

export default function SignInPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--df-bg)] px-4">
      <Suspense fallback={null}>
        <SignInForm />
      </Suspense>
    </div>
  );
}