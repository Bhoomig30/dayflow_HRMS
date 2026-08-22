import { cn } from "@/lib/utils/cn";

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-[var(--df-radius-sm)] bg-white/[0.06]", className)} />;
}

export function SkeletonCard() {
  return (
    <div className="rounded-[var(--df-radius-lg)] border border-[var(--df-border)] bg-[var(--df-surface)] p-5">
      <Skeleton className="h-3 w-24" />
      <Skeleton className="mt-3 h-7 w-16" />
      <Skeleton className="mt-2 h-3 w-32" />
    </div>
  );
}
