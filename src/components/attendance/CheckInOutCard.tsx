"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogIn, LogOut, Clock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { api, ClientApiError } from "@/lib/client/api";
import { attendanceStatusMeta } from "@/lib/ui/status";
import { formatTime } from "@/lib/ui/format";

interface TodayAttendance {
  status: string | null;
  checkInAt: string | null;
  checkOutAt: string | null;
}

export function CheckInOutCard({ today }: { today: TodayAttendance | null }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasCheckedIn = Boolean(today?.checkInAt);
  const hasCheckedOut = Boolean(today?.checkOutAt);

  async function act(kind: "check-in" | "check-out") {
    setLoading(true);
    setError(null);
    try {
      await api.post(`/api/attendance/${kind}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof ClientApiError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const meta = today?.status ? attendanceStatusMeta[today.status] : null;

  return (
    <Card>
      <CardContent className="pt-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-[var(--df-text-muted)]">
            <Clock className="size-3.5" /> Today
          </div>
          {meta && <Badge tone={meta.tone}>{meta.label}</Badge>}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-xs text-[var(--df-text-muted)]">Check-in</p>
            <p className="mt-0.5 font-medium text-[var(--df-text-primary)]">{formatTime(today?.checkInAt)}</p>
          </div>
          <div>
            <p className="text-xs text-[var(--df-text-muted)]">Check-out</p>
            <p className="mt-0.5 font-medium text-[var(--df-text-primary)]">{formatTime(today?.checkOutAt)}</p>
          </div>
        </div>

        {error && (
          <Alert tone="danger" className="mt-4">
            {error}
          </Alert>
        )}

        <div className="mt-5 flex gap-2">
          <Button className="flex-1" onClick={() => act("check-in")} disabled={hasCheckedIn} loading={loading && !hasCheckedIn}>
            <LogIn className="size-4" /> Check in
          </Button>
          <Button
            variant="secondary"
            className="flex-1"
            onClick={() => act("check-out")}
            disabled={!hasCheckedIn || hasCheckedOut}
            loading={loading && hasCheckedIn && !hasCheckedOut}
          >
            <LogOut className="size-4" /> Check out
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
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
