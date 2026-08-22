import { requireHrForPage } from "@/lib/auth/pageGuards";
import { ChatWindow } from "@/components/ai/ChatWindow";

const suggestions = ["Summarize attendance anomalies.", "Which departments need attention?", "Show pending leave requests."];

export default async function HrAiPage() {
  await requireHrForPage();
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-[var(--df-text-primary)]">Dayflow AI</h1>
        <p className="mt-1 text-sm text-[var(--df-text-muted)]">HR-level aggregate data only — no per-employee payroll or personal leave lookups.</p>
      </div>
      <ChatWindow suggestions={suggestions} />
    </div>
  );
}
