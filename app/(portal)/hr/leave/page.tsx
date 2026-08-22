import { requireHrForPage } from "@/lib/auth/pageGuards";
import { LeaveReviewPanel } from "@/components/leave/LeaveReviewPanel";

export default async function HrLeavePage() {
  await requireHrForPage();
  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-[var(--df-text-primary)]">Leave requests</h1>
        <p className="mt-1 text-sm text-[var(--df-text-muted)]">Review, approve or reject — changes reflect in attendance and notifications immediately.</p>
      </div>
      <LeaveReviewPanel />
    </div>
  );
}
