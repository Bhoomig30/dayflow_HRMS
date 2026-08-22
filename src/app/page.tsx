import Link from "next/link";
import { CalendarCheck, ClipboardList, Sparkles, Wallet, ShieldCheck, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/Button";

const features = [
  { icon: CalendarCheck, title: "Attendance, made honest", desc: "Real check-in/out, calendar heatmaps, and explainable anomaly detection — no invented numbers." },
  { icon: ClipboardList, title: "Leave that stays consistent", desc: "Submit, approve, reject — attendance, balances and notifications update together, every time." },
  { icon: Wallet, title: "Payroll you can trust", desc: "Stored figures, published payslips, zero invented tax rules." },
  { icon: BarChart3, title: "Analytics from real data", desc: "Every chart is a live aggregate. No data yet? You'll see an honest empty state, not a fake one." },
  { icon: Sparkles, title: "Dayflow AI", desc: "Ask about your attendance, leave or payroll — answered only from data you're authorized to see." },
  { icon: ShieldCheck, title: "Server-side security", desc: "Role-based access enforced on every API route, not just hidden in the UI." },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-[var(--df-bg)]">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2.5">
          <div className="flex size-9 items-center justify-center rounded-[var(--df-radius-md)] bg-[var(--df-accent-soft)] font-bold text-[var(--df-accent)]">
            D
          </div>
          <span className="text-sm font-semibold text-[var(--df-text-primary)]">Dayflow</span>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/sign-in">
            <Button variant="ghost" size="sm">Sign in</Button>
          </Link>
          <Link href="/sign-up">
            <Button variant="primary" size="sm">Get started</Button>
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 pb-24 pt-12 sm:pt-20">
        <div className="max-w-2xl">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--df-accent)]/30 bg-[var(--df-accent-soft)] px-3 py-1 text-xs font-medium text-[var(--df-accent)]">
            Human Resource Management System
          </span>
          <h1 className="mt-5 text-4xl font-semibold tracking-tight text-[var(--df-text-primary)] sm:text-5xl">
            Every workday, perfectly aligned.
          </h1>
          <p className="mt-4 text-base leading-relaxed text-[var(--df-text-secondary)] sm:text-lg">
            Dayflow brings attendance, leave, payroll, analytics and an AI assistant into one role-aware
            platform — built on real data, not placeholders.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/sign-up">
              <Button size="lg">Create an account</Button>
            </Link>
            <Link href="/sign-in">
              <Button variant="secondary" size="lg">I already have an account</Button>
            </Link>
          </div>
        </div>

        <div className="mt-20 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <div key={f.title} className="rounded-[var(--df-radius-lg)] border border-[var(--df-border)] bg-[var(--df-surface)] p-5">
              <div className="flex size-9 items-center justify-center rounded-[var(--df-radius-md)] bg-[var(--df-accent-soft)] text-[var(--df-accent)]">
                <f.icon className="size-4.5" aria-hidden />
              </div>
              <p className="mt-3 text-sm font-semibold text-[var(--df-text-primary)]">{f.title}</p>
              <p className="mt-1 text-xs leading-relaxed text-[var(--df-text-muted)]">{f.desc}</p>
            </div>
          ))}
        </div>
      </main>

      <footer className="border-t border-[var(--df-border)] px-6 py-6 text-center text-xs text-[var(--df-text-muted)]">
        Dayflow HRMS — demo application.
      </footer>
    </div>
  );
}
