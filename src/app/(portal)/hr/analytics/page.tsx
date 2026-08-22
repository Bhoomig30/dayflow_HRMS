import { requireHrForPage } from "@/lib/auth/pageGuards";
import { AnalyticsDashboard } from "@/components/hr/AnalyticsDashboard";

export default async function HrAnalyticsPage() {
  await requireHrForPage();
  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-[var(--df-text-primary)]">Analytics</h1>
        <p className="mt-1 text-sm text-[var(--df-text-muted)]">Every figure below is a live aggregate over stored records.</p>
      </div>
      <AnalyticsDashboard />
    </div>
  );
}
