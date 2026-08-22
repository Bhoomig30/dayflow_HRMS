import { requireSessionForPage } from "@/lib/auth/pageGuards";
import { ChatWindow } from "@/components/ai/ChatWindow";

const suggestions = ["How is my attendance this month?", "How many leave days do I have?", "Explain my latest payslip."];

export default async function EmployeeAiPage() {
  await requireSessionForPage();
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-[var(--df-text-primary)]">Dayflow AI</h1>
        <p className="mt-1 text-sm text-[var(--df-text-muted)]">Answers are limited to your own data — Dayflow AI has no way to see anyone else&apos;s.</p>
      </div>
      <ChatWindow suggestions={suggestions} />
    </div>
  );
}