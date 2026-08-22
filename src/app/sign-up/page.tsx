"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { UserPlus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input, Label, FieldHint } from "@/components/ui/Input";
import { Alert } from "@/components/ui/Alert";
import { api, ClientApiError } from "@/lib/client/api";

interface SignUpResponse {
  message: string;
  devEmailVerificationLink?: string;
}

export default function SignUpPage() {
  const router = useRouter();
  const [form, setForm] = useState({ fullName: "", employeeCode: "", email: "", password: "", department: "", jobTitle: "" });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [created, setCreated] = useState<SignUpResponse | null>(null);

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await api.post<SignUpResponse>("/api/auth/signup", form);
      setCreated(res);
    } catch (err) {
      setError(err instanceof ClientApiError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (created) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--df-bg)] px-4">
        <div className="w-full max-w-sm text-center">
          <h1 className="text-xl font-semibold text-[var(--df-text-primary)]">Verify your email</h1>
          <p className="mt-2 text-sm text-[var(--df-text-secondary)]">
            Your account was created, but you can&apos;t sign in until your email is verified.
          </p>
          <Alert tone="info" className="mt-5 text-left">
            {created.devEmailVerificationLink ? (
              <>
                No email provider is configured in this environment, so Dayflow can&apos;t actually send a verification
                email. In a deployment with a real provider configured, this link would be emailed to you instead of
                shown here:
                <br />
                <Link
                  href={created.devEmailVerificationLink}
                  className="mt-1 inline-block break-all font-medium text-[var(--df-accent)] hover:underline"
                >
                  {created.devEmailVerificationLink}
                </Link>
              </>
            ) : (
              created.message
            )}
          </Alert>
          <Button className="mt-6 w-full" onClick={() => router.push("/sign-in")}>
            Go to sign in
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--df-bg)] px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex items-center gap-2.5">
          <div className="flex size-9 items-center justify-center rounded-[var(--df-radius-md)] bg-[var(--df-accent-soft)] font-bold text-[var(--df-accent)]">D</div>
          <span className="text-sm font-semibold text-[var(--df-text-primary)]">Dayflow</span>
        </div>
        <h1 className="text-2xl font-semibold text-[var(--df-text-primary)]">Create your account</h1>
        <p className="mt-1 text-sm text-[var(--df-text-muted)]">This creates an employee account. HR accounts are provisioned by HR.</p>

        <form onSubmit={onSubmit} className="mt-6 space-y-4" noValidate>
          {error && <Alert tone="danger">{error}</Alert>}
          <div>
            <Label htmlFor="fullName">Full name</Label>
            <Input id="fullName" required value={form.fullName} onChange={(e) => set("fullName", e.target.value)} placeholder="Jordan Rivera" />
          </div>
          <div>
            <Label htmlFor="employeeCode">Employee ID</Label>
            <Input id="employeeCode" required value={form.employeeCode} onChange={(e) => set("employeeCode", e.target.value.toUpperCase())} placeholder="EMP1042" />
            <FieldHint>Letters, numbers and hyphens only — you&apos;ll use this to sign in.</FieldHint>
          </div>
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" autoComplete="email" required value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="you@company.com" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="department">Department</Label>
              <Input id="department" value={form.department} onChange={(e) => set("department", e.target.value)} placeholder="Engineering" />
            </div>
            <div>
              <Label htmlFor="jobTitle">Job title</Label>
              <Input id="jobTitle" value={form.jobTitle} onChange={(e) => set("jobTitle", e.target.value)} placeholder="Software Engineer" />
            </div>
          </div>
          <div>
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" autoComplete="new-password" required value={form.password} onChange={(e) => set("password", e.target.value)} placeholder="••••••••" />
            <FieldHint>At least 8 characters, with an uppercase letter, a lowercase letter and a number.</FieldHint>
          </div>
          <Button type="submit" className="w-full" loading={loading}>
            <UserPlus className="size-4" /> Create account
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-[var(--df-text-muted)]">
          Already have an account?{" "}
          <Link href="/sign-in" className="font-medium text-[var(--df-accent)] hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
